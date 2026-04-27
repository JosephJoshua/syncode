import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { CONTROL_API, ERROR_CODES } from '@syncode/contracts';
import { type Database } from '@syncode/db';
import { WHITEBOARD_ASSET_LIMITS } from '@syncode/shared';
import { CACHE_SERVICE, STORAGE_SERVICE } from '@syncode/shared/ports';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GlobalExceptionFilter } from '@/common/filters/global-exception.filter.js';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard.js';
import { AuthService } from '@/modules/auth/auth.service.js';
import { JwtStrategy } from '@/modules/auth/jwt.strategy.js';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import { InMemoryCacheService } from '@/test/in-memory-cache.service.js';
import {
  createTestDb,
  insertParticipant,
  insertRoom,
  insertUser,
} from '@/test/integration-setup.js';
import { createMockConfigService, createMockStorageService } from '@/test/mock-factories.js';
import { WhiteboardAssetsController } from './whiteboard-assets.controller.js';
import { WhiteboardAssetsService } from './whiteboard-assets.service.js';

const ACCESS_TOKEN_SECRET = 'access-secret-access-secret-123456';

let app: INestApplication;
let db: Database;
let cleanup: () => Promise<void>;
let jwtService: JwtService;
let storageService: ReturnType<typeof createMockStorageService>;

const baseRoute = (roomId: string) =>
  `/${CONTROL_API.WHITEBOARD_ASSETS.UPLOAD_URL.route.replace(':id', roomId)}`;

async function bearerFor(userId: string, email: string) {
  const user = await insertUser(db, { email, username: email.split('@')[0]! });
  // For controller integration, we use the real JwtAuthGuard with a real token
  const token = await jwtService.signAsync({ sub: user.id, email: user.email, type: 'access' });
  return { user, token };
}

beforeEach(async () => {
  const testDb = await createTestDb();
  db = testDb.db;
  cleanup = testDb.cleanup;
  jwtService = new JwtService({
    secret: ACCESS_TOKEN_SECRET,
    signOptions: { expiresIn: '15m' },
  });
  storageService = createMockStorageService();

  const module = await Test.createTestingModule({
    imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
    controllers: [WhiteboardAssetsController],
    providers: [
      WhiteboardAssetsService,
      AuthService,
      JwtAuthGuard,
      JwtStrategy,
      { provide: DB_CLIENT, useValue: db },
      { provide: CACHE_SERVICE, useValue: new InMemoryCacheService() },
      { provide: STORAGE_SERVICE, useValue: storageService },
      { provide: JwtService, useValue: jwtService },
      {
        provide: ConfigService,
        useValue: createMockConfigService({
          AUTH_JWT_SECRET: ACCESS_TOKEN_SECRET,
          JWT_REFRESH_SECRET: 'refresh-secret-refresh-secret-1234',
          JWT_REFRESH_EXPIRATION: '7d',
        }),
      },
    ],
  }).compile();

  app = module.createNestApplication();
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter());
  await app.init();
});

afterEach(async () => {
  await app.close();
  await cleanup();
});

describe('POST /rooms/:id/whiteboard/assets/upload-url', () => {
  it('GIVEN authenticated candidate participant WHEN uploading an image THEN returns presigned URLs and a stable storage key', async () => {
    const host = await bearerFor('host-asset@test.com', 'host-asset@test.com');
    const candidate = await bearerFor('cand-asset@test.com', 'cand-asset@test.com');

    const room = await insertRoom(db, host.user.id);
    await insertParticipant(db, room.id, candidate.user.id, 'candidate');

    const response = await request(app.getHttpServer())
      .post(baseRoute(room.id))
      .set('Authorization', `Bearer ${candidate.token}`)
      .send({ filename: 'sketch.png', contentType: 'image/png', contentLength: 50_000 });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      uploadUrl: 'https://s3.example.com/presigned-put',
      downloadUrl: 'https://s3.example.com/presigned-get',
      key: expect.stringMatching(new RegExp(`^whiteboard/${room.id}/[a-f0-9-]+-sketch\\.png$`)),
    });
    expect(storageService.getUploadUrl).toHaveBeenCalledWith(
      response.body.key,
      expect.objectContaining({ contentType: 'image/png' }),
    );
  });

  it('GIVEN observer participant WHEN uploading THEN succeeds because annotate covers asset uploads', async () => {
    const host = await bearerFor('host-obs@test.com', 'host-obs@test.com');
    const observer = await bearerFor('obs-obs@test.com', 'obs-obs@test.com');

    const room = await insertRoom(db, host.user.id);
    await insertParticipant(db, room.id, observer.user.id, 'observer');

    const response = await request(app.getHttpServer())
      .post(baseRoute(room.id))
      .set('Authorization', `Bearer ${observer.token}`)
      .send({ filename: 'note.png', contentType: 'image/png', contentLength: 1_000 });

    expect(response.status).toBe(201);
  });

  it('GIVEN non-participant WHEN uploading THEN returns 403 with ROOM_ACCESS_DENIED', async () => {
    const host = await bearerFor('host-np@test.com', 'host-np@test.com');
    const stranger = await bearerFor('stranger@test.com', 'stranger@test.com');

    const room = await insertRoom(db, host.user.id);

    const response = await request(app.getHttpServer())
      .post(baseRoute(room.id))
      .set('Authorization', `Bearer ${stranger.token}`)
      .send({ filename: 'foo.png', contentType: 'image/png', contentLength: 1_000 });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe(ERROR_CODES.ROOM_ACCESS_DENIED);
  });

  it('GIVEN missing room WHEN uploading THEN returns 404 with ROOM_NOT_FOUND', async () => {
    const stranger = await bearerFor('stranger-missing@test.com', 'stranger-missing@test.com');

    const response = await request(app.getHttpServer())
      .post(baseRoute('00000000-0000-0000-0000-000000000000'))
      .set('Authorization', `Bearer ${stranger.token}`)
      .send({ filename: 'foo.png', contentType: 'image/png', contentLength: 1_000 });

    expect(response.status).toBe(404);
    expect(response.body.code).toBe(ERROR_CODES.ROOM_NOT_FOUND);
  });

  it('GIVEN image larger than the per-image limit WHEN uploading THEN returns 413 with WHITEBOARD_ASSET_TOO_LARGE', async () => {
    const host = await bearerFor('host-big@test.com', 'host-big@test.com');
    const candidate = await bearerFor('cand-big@test.com', 'cand-big@test.com');

    const room = await insertRoom(db, host.user.id);
    await insertParticipant(db, room.id, candidate.user.id, 'candidate');

    const response = await request(app.getHttpServer())
      .post(baseRoute(room.id))
      .set('Authorization', `Bearer ${candidate.token}`)
      .send({
        filename: 'huge.png',
        contentType: 'image/png',
        contentLength: WHITEBOARD_ASSET_LIMITS.MAX_IMAGE_BYTES + 1,
      });

    expect(response.status).toBe(413);
    expect(response.body.code).toBe(ERROR_CODES.WHITEBOARD_ASSET_TOO_LARGE);
  });

  it('GIVEN forbidden content type WHEN uploading THEN returns 400 (Zod validation)', async () => {
    const host = await bearerFor('host-mime@test.com', 'host-mime@test.com');
    const candidate = await bearerFor('cand-mime@test.com', 'cand-mime@test.com');

    const room = await insertRoom(db, host.user.id);
    await insertParticipant(db, room.id, candidate.user.id, 'candidate');

    const response = await request(app.getHttpServer())
      .post(baseRoute(room.id))
      .set('Authorization', `Bearer ${candidate.token}`)
      .send({
        filename: 'evil.exe',
        contentType: 'application/octet-stream',
        contentLength: 1_000,
      });

    expect(response.status).toBe(400);
  });

  it('GIVEN no auth header WHEN uploading THEN returns 401', async () => {
    const host = await bearerFor('host-anon@test.com', 'host-anon@test.com');
    const room = await insertRoom(db, host.user.id);

    const response = await request(app.getHttpServer())
      .post(baseRoute(room.id))
      .send({ filename: 'foo.png', contentType: 'image/png', contentLength: 1_000 });

    expect(response.status).toBe(401);
  });

  it('GIVEN inactive participant WHEN uploading THEN returns 403', async () => {
    const host = await bearerFor('host-left@test.com', 'host-left@test.com');
    const left = await bearerFor('left@test.com', 'left@test.com');

    const room = await insertRoom(db, host.user.id);
    await insertParticipant(db, room.id, left.user.id, 'candidate', { isActive: false });

    const response = await request(app.getHttpServer())
      .post(baseRoute(room.id))
      .set('Authorization', `Bearer ${left.token}`)
      .send({ filename: 'foo.png', contentType: 'image/png', contentLength: 1_000 });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe(ERROR_CODES.ROOM_ACCESS_DENIED);
  });

  it('GIVEN filename containing unsafe characters WHEN uploading THEN sanitizes them in the storage key', async () => {
    const host = await bearerFor('host-clean@test.com', 'host-clean@test.com');
    const candidate = await bearerFor('cand-clean@test.com', 'cand-clean@test.com');

    const room = await insertRoom(db, host.user.id);
    await insertParticipant(db, room.id, candidate.user.id, 'candidate');

    const response = await request(app.getHttpServer())
      .post(baseRoute(room.id))
      .set('Authorization', `Bearer ${candidate.token}`)
      .send({
        filename: 'my  weird/../file *.png',
        contentType: 'image/png',
        contentLength: 1_000,
      });

    expect(response.status).toBe(201);
    expect(response.body.key).toMatch(/^whiteboard\/[^/]+\/[a-f0-9-]+-my_weird_.._file_.png$/);
    expect(response.body.key).not.toContain(' ');
  });
});
