import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import {
  aiHints,
  aiMessages,
  aiReviews,
  type Database,
  rooms,
  runs,
  submissions,
} from '@syncode/db';
import { CACHE_SERVICE } from '@syncode/shared/ports';
import { eq } from 'drizzle-orm';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { GlobalExceptionFilter } from '@/common/filters/global-exception.filter';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { AuthService } from '@/modules/auth/auth.service';
import { DB_CLIENT } from '@/modules/db/db.module';
import { InMemoryCacheService } from '@/test/in-memory-cache.service';
import { createTestDb, insertProblem, insertUser } from '@/test/integration-setup';
import { createMockConfigService } from '@/test/mock-factories';
import { JwtStrategy } from '../auth/jwt.strategy.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

const ACCESS_TOKEN_SECRET = 'access-secret-access-secret-123456';

let app: INestApplication;
let db: Database;
let cleanup: () => Promise<void>;
let jwtService: JwtService;

beforeEach(async () => {
  const testDb = await createTestDb();
  db = testDb.db;
  cleanup = testDb.cleanup;
  jwtService = new JwtService({
    secret: ACCESS_TOKEN_SECRET,
    signOptions: { expiresIn: '15m' },
  });

  const module = await Test.createTestingModule({
    imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
    controllers: [UsersController],
    providers: [
      UsersService,
      AuthService,
      JwtAuthGuard,
      JwtStrategy,
      { provide: DB_CLIENT, useValue: db },
      { provide: CACHE_SERVICE, useValue: new InMemoryCacheService() },
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

describe('GET /users/me', () => {
  it('GIVEN valid bearer token WHEN fetching current profile THEN returns the authenticated user', async () => {
    const user = await insertUser(db, {
      email: 'alice@example.com',
      username: 'alice_sync',
    });
    const accessToken = await jwtService.signAsync({
      sub: user.id,
      email: user.email,
      tokenType: 'access',
    });

    const res = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      stats: {
        totalSessions: 0,
        totalProblems: 0,
        streakDays: 0,
      },
    });
  });

  it('GIVEN no bearer token WHEN fetching current profile THEN returns 401', async () => {
    const res = await request(app.getHttpServer()).get('/users/me');
    expect(res.status).toBe(401);
  });
});

describe('GET /users/me/quotas', () => {
  it('GIVEN valid bearer token WHEN fetching quotas THEN returns current usage counts and limits', async () => {
    const user = await insertUser(db, {
      email: 'alice@example.com',
      username: 'alice_sync',
    });
    const otherUser = await insertUser(db, {
      email: 'other@example.com',
      username: 'other_sync',
    });
    const accessToken = await jwtService.signAsync({
      sub: user.id,
      email: user.email,
      tokenType: 'access',
    });

    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const beforeToday = new Date(startOfToday.getTime() - 60_000);
    const problem = await insertProblem(db);

    const [activeRoomOne] = await db
      .insert(rooms)
      .values({
        hostId: user.id,
        mode: 'peer',
        inviteCode: 'QTA001',
        status: 'waiting',
      })
      .returning();
    const [activeRoomTwo] = await db
      .insert(rooms)
      .values({
        hostId: user.id,
        mode: 'peer',
        inviteCode: 'QTA002',
        status: 'coding',
      })
      .returning();
    await db.insert(rooms).values({
      hostId: user.id,
      mode: 'peer',
      inviteCode: 'QTA003',
      status: 'finished',
    });
    await db.insert(rooms).values({
      hostId: otherUser.id,
      mode: 'peer',
      inviteCode: 'QTA004',
      status: 'waiting',
    });

    await db.insert(aiHints).values({
      roomId: activeRoomOne!.id,
      userId: user.id,
      hint: 'hint',
      hintLevel: 'subtle',
      createdAt: new Date(),
    });
    await db.insert(aiReviews).values({
      roomId: activeRoomOne!.id,
      userId: user.id,
      overallScore: 5,
      categories: {},
      suggestions: {},
      summary: 'review',
      createdAt: new Date(),
    });
    await db.insert(aiMessages).values([
      {
        roomId: activeRoomOne!.id,
        userId: user.id,
        role: 'user',
        content: 'hello',
        createdAt: new Date(),
      },
      {
        roomId: activeRoomOne!.id,
        userId: user.id,
        role: 'assistant',
        content: 'reply',
        createdAt: beforeToday,
      },
    ]);
    await db.insert(runs).values([
      {
        userId: user.id,
        roomId: activeRoomOne!.id,
        jobId: 'job-1',
        code: 'print(1)',
        language: 'python',
        createdAt: new Date(),
      },
      {
        userId: user.id,
        roomId: activeRoomOne!.id,
        jobId: 'job-2',
        code: 'print(2)',
        language: 'python',
        createdAt: beforeToday,
      },
    ]);
    await db.insert(submissions).values([
      {
        userId: user.id,
        roomId: activeRoomTwo!.id,
        problemId: problem.id,
        code: 'print(3)',
        language: 'python',
        totalTestCases: 1,
        submittedAt: new Date(),
      },
      {
        userId: user.id,
        roomId: activeRoomTwo!.id,
        problemId: problem.id,
        code: 'print(4)',
        language: 'python',
        totalTestCases: 1,
        submittedAt: beforeToday,
      },
    ]);

    const res = await request(app.getHttpServer())
      .get('/users/me/quotas')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.ai).toMatchObject({
      used: 3,
      limit: 100,
    });
    expect(res.body.execution).toMatchObject({
      used: 2,
      limit: 100,
    });
    expect(res.body.rooms).toEqual({
      activeCount: 2,
      maxActive: 100,
    });

    const aiReset = new Date(res.body.ai.resetsAt);
    const executionReset = new Date(res.body.execution.resetsAt);
    expect(aiReset.toISOString()).toBe(res.body.ai.resetsAt);
    expect(executionReset.toISOString()).toBe(res.body.execution.resetsAt);
    expect(aiReset.getUTCHours()).toBe(0);
    expect(aiReset.getUTCMinutes()).toBe(0);
  });

  it('GIVEN no bearer token WHEN fetching quotas THEN returns 401', async () => {
    const res = await request(app.getHttpServer()).get('/users/me/quotas');
    expect(res.status).toBe(401);
  });
});

describe('GET /users/:id', () => {
  it('GIVEN valid bearer token WHEN fetching another public profile THEN returns public fields only', async () => {
    const requester = await insertUser(db, {
      email: 'requester@example.com',
      username: 'requester_sync',
    });
    const target = await insertUser(db, {
      email: 'alice@example.com',
      username: 'alice_sync',
      displayName: 'Alice',
      bio: 'Public bio',
    });
    const accessToken = await jwtService.signAsync({
      sub: requester.id,
      email: requester.email,
      tokenType: 'access',
    });

    const res = await request(app.getHttpServer())
      .get(`/users/${target.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: target.id,
      username: target.username,
      displayName: target.displayName,
      avatarUrl: target.avatarUrl,
      bio: target.bio,
      createdAt: target.createdAt.toISOString(),
    });
  });

  it('GIVEN valid bearer token WHEN public profile is missing THEN returns 404 with user code', async () => {
    const requester = await insertUser(db, {
      email: 'requester@example.com',
      username: 'requester_sync',
    });
    const accessToken = await jwtService.signAsync({
      sub: requester.id,
      email: requester.email,
      tokenType: 'access',
    });

    const res = await request(app.getHttpServer())
      .get('/users/497f6eca-6276-4993-bfeb-53cbbbba6f08')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('USER_NOT_FOUND');
    expect(res.body.message).toBe('User not found');
  });

  it('GIVEN no bearer token WHEN fetching another public profile THEN returns 401', async () => {
    const res = await request(app.getHttpServer()).get(
      '/users/497f6eca-6276-4993-bfeb-53cbbbba6f08',
    );

    expect(res.status).toBe(401);
  });
});

describe('PATCH /users/me', () => {
  it('GIVEN valid bearer token and body WHEN updating current profile THEN returns updated profile', async () => {
    const user = await insertUser(db, {
      email: 'alice@example.com',
      username: 'alice_sync',
      displayName: 'Alice',
      bio: 'Old bio',
    });
    const accessToken = await jwtService.signAsync({
      sub: user.id,
      email: user.email,
      tokenType: 'access',
    });

    const res = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        displayName: 'Alice Doe',
        bio: 'Updated bio',
        username: 'alice_doe',
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: user.id,
      email: user.email,
      username: 'alice_doe',
      displayName: 'Alice Doe',
      bio: 'Updated bio',
    });
  });

  it('GIVEN invalid username WHEN updating current profile THEN returns 400 with validation code', async () => {
    const user = await insertUser(db, {
      email: 'alice@example.com',
      username: 'alice_sync',
    });
    const accessToken = await jwtService.signAsync({
      sub: user.id,
      email: user.email,
      tokenType: 'access',
    });

    const res = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        username: 'a!',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.details.username).toEqual(expect.any(String));
  });

  it('GIVEN taken username WHEN updating current profile THEN returns 409 with username taken code', async () => {
    const existingUser = await insertUser(db, {
      email: 'existing@example.com',
      username: 'existing_user',
    });
    const user = await insertUser(db, {
      email: 'alice@example.com',
      username: 'alice_sync',
    });
    const accessToken = await jwtService.signAsync({
      sub: user.id,
      email: user.email,
      tokenType: 'access',
    });

    const res = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        username: existingUser.username,
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('USER_USERNAME_TAKEN');
    expect(res.body.message).toBe('Username already taken');
  });
});

describe('DELETE /users/me', () => {
  it('GIVEN valid bearer token WHEN soft deleting current account THEN returns 204 and invalidates later access', async () => {
    const user = await insertUser(db, {
      email: 'alice@example.com',
      username: 'alice_sync',
    });
    const accessToken = await jwtService.signAsync({
      sub: user.id,
      email: user.email,
      tokenType: 'access',
    });

    const deleteResponse = await request(app.getHttpServer())
      .delete('/users/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(deleteResponse.status).toBe(204);
    expect(deleteResponse.body).toEqual({});

    const deletedUser = await db.query.users.findFirst({
      columns: {
        deletedAt: true,
      },
      where: (table) => eq(table.id, user.id),
    });

    expect(deletedUser?.deletedAt).toBeInstanceOf(Date);

    const profileResponse = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(profileResponse.status).toBe(401);
  });

  it('GIVEN no bearer token WHEN deleting current account THEN returns 401', async () => {
    const res = await request(app.getHttpServer()).delete('/users/me');
    expect(res.status).toBe(401);
  });
});
