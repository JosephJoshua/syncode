import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { COLLAB_CLIENT, EXECUTION_CLIENT } from '@syncode/contracts';
import type { Database } from '@syncode/db';
import { CACHE_SERVICE, MEDIA_SERVICE, STORAGE_SERVICE } from '@syncode/shared/ports';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard.js';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import { ExecutionService } from '@/modules/execution/execution.service.js';
import { InMemoryCacheService } from '@/test/in-memory-cache.service.js';
import {
  createTestDb,
  insertParticipant,
  insertProblem,
  insertRoom,
  insertTestCase,
  insertUser,
} from '@/test/integration-setup.js';
import {
  asUser,
  createMockCollabClient,
  createMockConfigService,
  createMockExecutionClient,
  createMockJwtService,
  createMockMediaService,
  createMockStorageService,
  TestAuthGuard,
} from '@/test/mock-factories.js';
import { RoomsController } from './rooms.controller.js';
import { RoomsService } from './rooms.service.js';

let app: INestApplication;
let db: Database;
let cleanup: () => Promise<void>;
let mockMediaService: ReturnType<typeof createMockMediaService>;

beforeEach(async () => {
  vi.clearAllMocks();

  const testDb = await createTestDb();
  db = testDb.db;
  cleanup = testDb.cleanup;
  mockMediaService = createMockMediaService();

  const module = await Test.createTestingModule({
    controllers: [RoomsController],
    providers: [
      RoomsService,
      ExecutionService,
      { provide: DB_CLIENT, useValue: db },
      { provide: EXECUTION_CLIENT, useValue: createMockExecutionClient() },
      { provide: CACHE_SERVICE, useValue: new InMemoryCacheService() },
      { provide: COLLAB_CLIENT, useValue: createMockCollabClient() },
      { provide: MEDIA_SERVICE, useValue: mockMediaService },
      { provide: STORAGE_SERVICE, useValue: createMockStorageService() },
      { provide: JwtService, useValue: createMockJwtService() },
      { provide: ConfigService, useValue: createMockConfigService() },
      Reflector,
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useClass(TestAuthGuard)
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
    const user = await insertUser(db);

    const res = await asUser(request(app.getHttpServer()).post('/rooms'), user)
      .send({ mode: 'peer' })
      .expect(201);

    expect(res.body.roomId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.roomCode).toHaveLength(6);
    expect(res.body.status).toBe('waiting');
    expect(res.body.hostId).toBe(user.id);
    expect(res.body.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(res.body.config).toEqual({
      maxParticipants: 2,
      maxDuration: 120,
      isPrivate: true,
    });
  });

  it('GIVEN missing mode WHEN creating room THEN returns 400', async () => {
    const user = await insertUser(db);

    await asUser(request(app.getHttpServer()).post('/rooms'), user).send({}).expect(400);
  });
});

describe('GET /rooms', () => {
  it('GIVEN rooms exist WHEN listing THEN returns paginated response with ISO timestamps', async () => {
    const user = await insertUser(db);
    const room = await insertRoom(db, user.id);
    await insertParticipant(db, room.id, user.id, 'interviewer');

    const res = await asUser(request(app.getHttpServer()).get('/rooms'), user).expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].roomId).toBe(room.id);
    expect(res.body.data[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(res.body.data[0].myRole).toBe('interviewer');
    expect(res.body.pagination).toEqual({ nextCursor: null, hasMore: false });
  });
});

describe('GET /rooms/public', () => {
  it('GIVEN one public and one private waiting room WHEN fetching with auth THEN returns only the public room', async () => {
    const host = await insertUser(db);
    const caller = await insertUser(db);
    const publicRoom = await insertRoom(db, host.id, {
      isPrivate: false,
      status: 'waiting',
    });
    await insertParticipant(db, publicRoom.id, host.id, 'interviewer');
    const privateRoom = await insertRoom(db, host.id, {
      isPrivate: true,
      status: 'waiting',
    });
    await insertParticipant(db, privateRoom.id, host.id, 'interviewer');

    const res = await asUser(request(app.getHttpServer()).get('/rooms/public'), caller).expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].roomId).toBe(publicRoom.id);
    expect(res.body.data[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(res.body.pagination).toEqual({ nextCursor: null, hasMore: false });
  });

  it('GIVEN unauthenticated request WHEN fetching public rooms THEN returns 401', async () => {
    await request(app.getHttpServer()).get('/rooms/public').expect(401);
  });

  it('GIVEN easy and hard problem rooms WHEN filtering by difficulty=easy THEN hard-difficulty rooms are excluded', async () => {
    const host = await insertUser(db);
    const caller = await insertUser(db);
    const easyProblem = await insertProblem(db, { difficulty: 'easy' });
    const hardProblem = await insertProblem(db, { difficulty: 'hard' });
    const easyRoom = await insertRoom(db, host.id, {
      isPrivate: false,
      status: 'waiting',
      problemId: easyProblem.id,
    });
    await insertParticipant(db, easyRoom.id, host.id, 'interviewer');
    const hardRoom = await insertRoom(db, host.id, {
      isPrivate: false,
      status: 'waiting',
      problemId: hardProblem.id,
    });
    await insertParticipant(db, hardRoom.id, host.id, 'interviewer');

    const res = await asUser(
      request(app.getHttpServer()).get('/rooms/public').query({ difficulty: 'easy' }),
      caller,
    ).expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].roomId).toBe(easyRoom.id);
    expect(res.body.data[0].problemDifficulty).toBe('easy');
  });

  it('GIVEN a room linked to "Two Sum" WHEN searching case-insensitively THEN it is returned', async () => {
    const host = await insertUser(db);
    const caller = await insertUser(db);
    const twoSum = await insertProblem(db, { title: 'Two Sum' });
    const merge = await insertProblem(db, { title: 'Merge Intervals' });
    const twoSumRoom = await insertRoom(db, host.id, {
      isPrivate: false,
      status: 'waiting',
      problemId: twoSum.id,
    });
    await insertParticipant(db, twoSumRoom.id, host.id, 'interviewer');
    const mergeRoom = await insertRoom(db, host.id, {
      isPrivate: false,
      status: 'waiting',
      problemId: merge.id,
    });
    await insertParticipant(db, mergeRoom.id, host.id, 'interviewer');

    const res = await asUser(
      request(app.getHttpServer()).get('/rooms/public').query({ search: 'two' }),
      caller,
    ).expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].roomId).toBe(twoSumRoom.id);
    expect(res.body.data[0].problemTitle).toBe('Two Sum');
  });

  it('GIVEN invalid status filter WHEN fetching public rooms THEN returns 400', async () => {
    const caller = await insertUser(db);

    await asUser(
      request(app.getHttpServer()).get('/rooms/public').query({ status: 'not-a-real-status' }),
      caller,
    ).expect(400);
  });
});

describe('GET /rooms/:id', () => {
  it('GIVEN user is participant WHEN getting room THEN returns detail with ISO timestamps on participants', async () => {
    const user = await insertUser(db);
    const room = await insertRoom(db, user.id);
    await insertParticipant(db, room.id, user.id, 'interviewer');

    const res = await asUser(request(app.getHttpServer()).get(`/rooms/${room.id}`), user).expect(
      200,
    );

    expect(res.body.roomId).toBe(room.id);
    expect(res.body.participants).toHaveLength(1);
    expect(res.body.participants[0].joinedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(res.body.myRole).toBe('interviewer');
    expect(res.body.myCapabilities).toEqual(
      expect.arrayContaining(['code:edit', 'participant:kick']),
    );
    expect(res.body.currentPhaseStartedAt).toBeNull();
  });

  it('GIVEN user is not a participant WHEN getting room THEN returns 403', async () => {
    const user = await insertUser(db);
    const otherUser = await insertUser(db);
    const room = await insertRoom(db, otherUser.id);
    await insertParticipant(db, room.id, otherUser.id, 'interviewer');

    await asUser(request(app.getHttpServer()).get(`/rooms/${room.id}`), user).expect(403);
  });

  it('GIVEN room does not exist WHEN getting room THEN returns 404', async () => {
    const user = await insertUser(db);

    await asUser(
      request(app.getHttpServer()).get('/rooms/00000000-0000-0000-0000-000000000000'),
      user,
    ).expect(404);
  });
});

describe('POST /rooms/:id/join', () => {
  it('GIVEN valid room code WHEN joining THEN returns 200 with room detail, collab credentials, and ISO timestamps', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id, { maxParticipants: 4 });
    await insertParticipant(db, room.id, host.id, 'interviewer');

    const joiner = await insertUser(db);

    const res = await asUser(request(app.getHttpServer()).post(`/rooms/${room.id}/join`), joiner)
      .send({ roomCode: room.inviteCode })
      .expect(200);

    expect(res.body.assignedRole).toBe('candidate');
    expect(res.body.collabToken).toBe('test-collab-token');
    expect(res.body.collabUrl).toBe('http://localhost:3001');
    expect(res.body.myCapabilities).toEqual(expect.arrayContaining(['code:edit', 'code:run']));
    expect(res.body.room.roomId).toBe(room.id);
    expect(res.body.room.participants).toHaveLength(2);
    expect(res.body.room.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(res.body.room.participants[0].joinedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('GIVEN room does not exist WHEN joining THEN returns 404', async () => {
    const user = await insertUser(db);

    await asUser(
      request(app.getHttpServer()).post('/rooms/00000000-0000-0000-0000-000000000000/join'),
      user,
    )
      .send({ roomCode: 'ABCDEF' })
      .expect(404);
  });

  it('GIVEN user already a participant WHEN joining THEN returns 409', async () => {
    const user = await insertUser(db);
    const room = await insertRoom(db, user.id, { maxParticipants: 4 });
    await insertParticipant(db, room.id, user.id, 'interviewer');

    await asUser(request(app.getHttpServer()).post(`/rooms/${room.id}/join`), user)
      .send({ roomCode: room.inviteCode })
      .expect(409);
  });
});

describe('POST /rooms/:id/ownership/transfer', () => {
  it('GIVEN host transfers ownership WHEN request succeeds THEN returns ISO timestamp and new host ids', async () => {
    const host = await insertUser(db);
    const target = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, target.id, 'candidate');

    const res = await asUser(
      request(app.getHttpServer()).post(`/rooms/${room.id}/ownership/transfer`),
      host,
    )
      .send({ targetUserId: target.id })
      .expect(200);

    expect(res.body.roomId).toBe(room.id);
    expect(res.body.previousHostId).toBe(host.id);
    expect(res.body.currentHostId).toBe(target.id);
    expect(res.body.transferredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('PATCH /rooms/:id/participants/:participantUserId', () => {
  it('GIVEN host updates participant role WHEN request succeeds THEN returns ISO timestamp and updated room detail', async () => {
    const host = await insertUser(db);
    const participant = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, participant.id, 'observer');

    const res = await asUser(
      request(app.getHttpServer()).patch(`/rooms/${room.id}/participants/${participant.id}`),
      host,
    )
      .send({ role: 'candidate' })
      .expect(200);

    expect(res.body.updatedUserId).toBe(participant.id);
    expect(res.body.previousRole).toBe('observer');
    expect(res.body.currentRole).toBe('candidate');
    expect(res.body.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(
      res.body.room.participants.find((item: { userId: string }) => item.userId === participant.id)
        ?.role,
    ).toBe('candidate');
  });
});

describe('POST /rooms/:id/control/transition', () => {
  it('GIVEN valid next phase WHEN transitioning THEN returns ISO timestamp with updated statuses', async () => {
    const host = await insertUser(db);
    const candidate = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    const res = await asUser(
      request(app.getHttpServer()).post(`/rooms/${room.id}/control/transition`),
      host,
    )
      .send({ targetStatus: 'warmup' })
      .expect(200);

    expect(res.body.roomId).toBe(room.id);
    expect(res.body.previousStatus).toBe('waiting');
    expect(res.body.currentStatus).toBe('warmup');
    expect(res.body.transitionedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('DELETE /rooms/:id', () => {
  it('GIVEN host WHEN destroying room THEN returns 200 with cleanup result', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer');

    const res = await asUser(request(app.getHttpServer()).delete(`/rooms/${room.id}`), host).expect(
      200,
    );

    expect(res.body.roomId).toBe(room.id);
    expect(res.body).toHaveProperty('collabDeleted');
    expect(res.body).toHaveProperty('mediaDeleted');
  });

  it('GIVEN non-host WHEN destroying room THEN returns 403', async () => {
    const host = await insertUser(db);
    const other = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, other.id, 'candidate');

    await asUser(request(app.getHttpServer()).delete(`/rooms/${room.id}`), other).expect(403);
  });
});

describe('POST /rooms/:id/run', () => {
  it('GIVEN coding room WHEN participant runs code THEN returns jobId', async () => {
    const host = await insertUser(db);
    const candidate = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'coding' });
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    const res = await asUser(request(app.getHttpServer()).post(`/rooms/${room.id}/run`), candidate)
      .send({ language: 'python', code: 'print("hi")' })
      .expect(202);

    expect(res.body.jobId).toBe('stub-job');
  });

  it('GIVEN observer WHEN running code THEN returns 403', async () => {
    const host = await insertUser(db);
    const observer = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'coding' });
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, observer.id, 'observer');

    await asUser(request(app.getHttpServer()).post(`/rooms/${room.id}/run`), observer)
      .send({ language: 'python', code: 'print("hi")' })
      .expect(403);
  });
});

describe('POST /rooms/:id/submit', () => {
  it('GIVEN coding room with problem and test cases WHEN submitting THEN returns submissionId', async () => {
    const host = await insertUser(db);
    const candidate = await insertUser(db);
    const problem = await insertProblem(db);
    await insertTestCase(db, problem.id);
    const room = await insertRoom(db, host.id, {
      status: 'coding',
      problemId: problem.id,
    });
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    const res = await asUser(
      request(app.getHttpServer()).post(`/rooms/${room.id}/submit`),
      candidate,
    )
      .send({ language: 'python', code: 'print(input())' })
      .expect(202);

    expect(res.body.submissionId).toEqual(expect.any(String));
  });
});

describe('POST /rooms/:id/media/token', () => {
  it('GIVEN active participant with media capability WHEN generating token THEN returns 200 with token, url, and expiresAt', async () => {
    const user = await insertUser(db);
    const room = await insertRoom(db, user.id, { status: 'coding' });
    await insertParticipant(db, room.id, user.id, 'interviewer');

    mockMediaService.generateToken.mockResolvedValue({
      token: 'lk-test-token',
      url: 'wss://livekit.example.com',
    });

    const res = await asUser(
      request(app.getHttpServer()).post(`/rooms/${room.id}/media/token`),
      user,
    ).expect(200);

    expect(res.body.token).toBe('lk-test-token');
    expect(res.body.url).toBe('wss://livekit.example.com');
    expect(res.body.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('GIVEN observer role WHEN generating token THEN returns 403', async () => {
    const host = await insertUser(db);
    const observer = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'coding' });
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, observer.id, 'observer');

    await asUser(
      request(app.getHttpServer()).post(`/rooms/${room.id}/media/token`),
      observer,
    ).expect(403);
  });

  it('GIVEN user is not a participant WHEN generating token THEN returns 403', async () => {
    const host = await insertUser(db);
    const stranger = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'coding' });
    await insertParticipant(db, room.id, host.id, 'interviewer');

    await asUser(
      request(app.getHttpServer()).post(`/rooms/${room.id}/media/token`),
      stranger,
    ).expect(403);
  });

  it('GIVEN room is finished WHEN generating token THEN returns 403', async () => {
    const user = await insertUser(db);
    const room = await insertRoom(db, user.id, { status: 'finished' });
    await insertParticipant(db, room.id, user.id, 'interviewer');

    await asUser(request(app.getHttpServer()).post(`/rooms/${room.id}/media/token`), user).expect(
      403,
    );
  });

  it('GIVEN room does not exist WHEN generating token THEN returns 404', async () => {
    const user = await insertUser(db);

    await asUser(
      request(app.getHttpServer()).post('/rooms/00000000-0000-0000-0000-000000000000/media/token'),
      user,
    ).expect(404);
  });

  it('GIVEN candidate role WHEN generating token THEN returns 200', async () => {
    const host = await insertUser(db);
    const candidate = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'coding' });
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    mockMediaService.generateToken.mockResolvedValue({
      token: 'lk-candidate-token',
      url: 'wss://livekit.example.com',
    });

    const res = await asUser(
      request(app.getHttpServer()).post(`/rooms/${room.id}/media/token`),
      candidate,
    ).expect(200);

    expect(res.body.token).toBe('lk-candidate-token');
  });
});

describe('PATCH /rooms/:id/language', () => {
  it('GIVEN a candidate member WHEN PATCH THEN 200 with updated detail (language in response body matches input)', async () => {
    const host = await insertUser(db);
    const candidate = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'coding', language: 'python' });
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    const res = await asUser(
      request(app.getHttpServer()).patch(`/rooms/${room.id}/language`),
      candidate,
    )
      .send({ language: 'javascript' })
      .expect(200);

    expect(res.body.language).toBe('javascript');
    expect(res.body.roomId).toBe(room.id);
  });

  it('GIVEN an observer member WHEN PATCH THEN 403', async () => {
    const host = await insertUser(db);
    const observer = await insertUser(db);
    const candidate = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'coding', language: 'python' });
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');
    await insertParticipant(db, room.id, observer.id, 'observer');

    await asUser(request(app.getHttpServer()).patch(`/rooms/${room.id}/language`), observer)
      .send({ language: 'javascript' })
      .expect(403);
  });

  it('GIVEN invalid language in body WHEN PATCH THEN 400', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'coding', language: 'python' });
    await insertParticipant(db, room.id, host.id, 'interviewer');

    await asUser(request(app.getHttpServer()).patch(`/rooms/${room.id}/language`), host)
      .send({ language: 'brainfuck' })
      .expect(400);
  });

  it('GIVEN non-member WHEN PATCH THEN 403', async () => {
    const host = await insertUser(db);
    const stranger = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'coding', language: 'python' });
    await insertParticipant(db, room.id, host.id, 'interviewer');

    await asUser(request(app.getHttpServer()).patch(`/rooms/${room.id}/language`), stranger)
      .send({ language: 'javascript' })
      .expect(403);
  });

  it('GIVEN unauthenticated WHEN PATCH THEN 401', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'coding', language: 'python' });
    await insertParticipant(db, room.id, host.id, 'interviewer');

    await request(app.getHttpServer())
      .patch(`/rooms/${room.id}/language`)
      .send({ language: 'javascript' })
      .expect(401);
  });
});
