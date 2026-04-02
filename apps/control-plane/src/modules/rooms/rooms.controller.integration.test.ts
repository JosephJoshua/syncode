import type { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { COLLAB_CLIENT, EXECUTION_CLIENT } from '@syncode/contracts';
import type { Database } from '@syncode/db';
import { MEDIA_SERVICE } from '@syncode/shared/ports';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { DB_CLIENT } from '@/modules/db/db.module';
import { createTestDb, insertParticipant, insertRoom, insertUser } from '@/test/integration-setup';
import {
  createMockCollabClient,
  createMockExecutionClient,
  createMockMediaService,
} from '@/test/mock-factories';
import { RoomsController } from './rooms.controller.js';
import { RoomsService } from './rooms.service.js';

const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';

class MockJwtAuthGuard {
  canActivate(context: any) {
    const req = context.switchToHttp().getRequest();
    req.user = { id: TEST_USER_ID, email: 'test@example.com' };
    return true;
  }
}

let app: INestApplication;
let db: Database;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  vi.clearAllMocks();

  const testDb = await createTestDb();
  db = testDb.db;
  cleanup = testDb.cleanup;

  await insertUser(db, { id: TEST_USER_ID, email: 'test@example.com', username: 'testuser' });

  const module = await Test.createTestingModule({
    controllers: [RoomsController],
    providers: [
      RoomsService,
      { provide: DB_CLIENT, useValue: db },
      { provide: EXECUTION_CLIENT, useValue: createMockExecutionClient() },
      { provide: COLLAB_CLIENT, useValue: createMockCollabClient() },
      { provide: MEDIA_SERVICE, useValue: createMockMediaService() },
      Reflector,
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useClass(MockJwtAuthGuard)
    .compile();

  app = module.createNestApplication();
  app.useGlobalPipes(new ZodValidationPipe());
  await app.init();
});

afterEach(async () => {
  await app.close();
  await cleanup();
});

describe('POST /rooms', () => {
  it('GIVEN valid body WHEN creating room THEN returns 201 with ISO timestamps and room code', async () => {
    const res = await request(app.getHttpServer())
      .post('/rooms')
      .send({ mode: 'peer' })
      .expect(201);

    expect(res.body.roomId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.roomCode).toHaveLength(6);
    expect(res.body.status).toBe('waiting');
    expect(res.body.hostId).toBe(TEST_USER_ID);
    expect(res.body.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(res.body.config).toEqual({
      maxParticipants: 2,
      maxDuration: 120,
      isPrivate: true,
    });
  });

  it('GIVEN missing mode WHEN creating room THEN returns 400', async () => {
    await request(app.getHttpServer()).post('/rooms').send({}).expect(400);
  });
});

describe('GET /rooms', () => {
  it('GIVEN rooms exist WHEN listing THEN returns paginated response with ISO timestamps', async () => {
    const room = await insertRoom(db, TEST_USER_ID);
    await insertParticipant(db, room.id, TEST_USER_ID, 'host');

    const res = await request(app.getHttpServer()).get('/rooms').expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].roomId).toBe(room.id);
    expect(res.body.data[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(res.body.data[0].myRole).toBe('host');
    expect(res.body.pagination).toEqual({ nextCursor: null, hasMore: false });
  });
});

describe('GET /rooms/:id', () => {
  it('GIVEN user is participant WHEN getting room THEN returns detail with ISO timestamps on participants', async () => {
    const room = await insertRoom(db, TEST_USER_ID);
    await insertParticipant(db, room.id, TEST_USER_ID, 'host');

    const res = await request(app.getHttpServer()).get(`/rooms/${room.id}`).expect(200);

    expect(res.body.roomId).toBe(room.id);
    expect(res.body.participants).toHaveLength(1);
    expect(res.body.participants[0].joinedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(res.body.myRole).toBe('host');
    expect(res.body.myCapabilities).toEqual(
      expect.arrayContaining(['code:edit', 'participant:kick']),
    );
    expect(res.body.currentPhaseStartedAt).toBeNull();
  });

  it('GIVEN user is not a participant WHEN getting room THEN returns 403', async () => {
    const otherUser = await insertUser(db);
    const room = await insertRoom(db, otherUser.id);
    await insertParticipant(db, room.id, otherUser.id, 'host');

    await request(app.getHttpServer()).get(`/rooms/${room.id}`).expect(403);
  });

  it('GIVEN room does not exist WHEN getting room THEN returns 404', async () => {
    await request(app.getHttpServer())
      .get('/rooms/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });
});
