import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AI_CLIENT, COLLAB_CLIENT, ERROR_CODES, EXECUTION_CLIENT } from '@syncode/contracts';
import type { Database } from '@syncode/db';
import { aiHints } from '@syncode/db';
import { CACHE_SERVICE, MEDIA_SERVICE, STORAGE_SERVICE } from '@syncode/shared/ports';
import { eq } from 'drizzle-orm';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard.js';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import { ExecutionService } from '@/modules/execution/execution.service.js';
import { SessionReportsService } from '@/modules/sessions/session-reports.service.js';
import { InMemoryCacheService } from '@/test/in-memory-cache.service.js';
import {
  createTestDb,
  insertParticipant,
  insertProblem,
  insertRoom,
  insertSession,
  insertTestCase,
  insertUser,
} from '@/test/integration-setup.js';
import {
  asUser,
  createMockAiClient,
  createMockCollabClient,
  createMockConfigService,
  createMockExecutionClient,
  createMockJwtService,
  createMockMediaService,
  createMockSessionReportsService,
  createMockStorageService,
  TestAuthGuard,
} from '@/test/mock-factories.js';
import { RoomsController } from './rooms.controller.js';
import { RoomsService } from './rooms.service.js';

let app: INestApplication;
let db: Database;
let cleanup: () => Promise<void>;
let mockMediaService: ReturnType<typeof createMockMediaService>;
let mockAiClient: ReturnType<typeof createMockAiClient>;

beforeEach(async () => {
  vi.clearAllMocks();

  const testDb = await createTestDb();
  db = testDb.db;
  cleanup = testDb.cleanup;
  mockMediaService = createMockMediaService();
  mockAiClient = createMockAiClient();

  const module = await Test.createTestingModule({
    controllers: [RoomsController],
    providers: [
      RoomsService,
      ExecutionService,
      { provide: DB_CLIENT, useValue: db },
      { provide: EXECUTION_CLIENT, useValue: createMockExecutionClient() },
      { provide: AI_CLIENT, useValue: mockAiClient },
      { provide: CACHE_SERVICE, useValue: new InMemoryCacheService() },
      { provide: COLLAB_CLIENT, useValue: createMockCollabClient() },
      { provide: MEDIA_SERVICE, useValue: mockMediaService },
      { provide: STORAGE_SERVICE, useValue: createMockStorageService() },
      { provide: JwtService, useValue: createMockJwtService() },
      { provide: ConfigService, useValue: createMockConfigService() },
      { provide: SessionReportsService, useValue: createMockSessionReportsService() },
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

    const res = await asUser(request(app.getHttpServer()).post('/rooms'), user).send({});

    expect(res.status).toBe(400);
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

    const res = await asUser(
      request(app.getHttpServer()).get('/rooms/public').query({ status: 'not-a-real-status' }),
      caller,
    );

    expect(res.status).toBe(400);
  });
});

describe('GET /rooms/:id', () => {
  it('GIVEN malformed room id WHEN getting room THEN returns 400 instead of reaching storage', async () => {
    const user = await insertUser(db);

    const res = await asUser(request(app.getHttpServer()).get('/rooms/not-a-uuid'), user);

    expect(res.status).toBe(400);
    expect(res.body.statusCode).toBe(400);
  });

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
    expect(res.body.sessionId).toBeNull();
    expect(res.body.currentPhaseStartedAt).toBeNull();
  });

  it('GIVEN room has a session WHEN getting room THEN returns the room session id', async () => {
    const user = await insertUser(db);
    const room = await insertRoom(db, user.id, { status: 'warmup' });
    await insertParticipant(db, room.id, user.id, 'interviewer');
    const session = await insertSession(db, room.id, { status: 'ongoing' });

    const res = await asUser(request(app.getHttpServer()).get(`/rooms/${room.id}`), user).expect(
      200,
    );

    expect(res.body.sessionId).toBe(session.id);
  });

  it('GIVEN user is not a participant WHEN getting room THEN returns 403', async () => {
    const user = await insertUser(db);
    const otherUser = await insertUser(db);
    const room = await insertRoom(db, otherUser.id);
    await insertParticipant(db, room.id, otherUser.id, 'interviewer');

    const res = await asUser(request(app.getHttpServer()).get(`/rooms/${room.id}`), user);

    expect(res.status).toBe(403);
  });

  it('GIVEN room does not exist WHEN getting room THEN returns 404', async () => {
    const user = await insertUser(db);

    const res = await asUser(
      request(app.getHttpServer()).get('/rooms/00000000-0000-0000-0000-000000000000'),
      user,
    );

    expect(res.status).toBe(404);
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
    expect(res.body.room.sessionId).toBeNull();
    expect(res.body.room.participants).toHaveLength(2);
    expect(res.body.room.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(res.body.room.participants[0].joinedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('GIVEN room does not exist WHEN joining THEN returns 404', async () => {
    const user = await insertUser(db);

    const res = await asUser(
      request(app.getHttpServer()).post('/rooms/00000000-0000-0000-0000-000000000000/join'),
      user,
    ).send({ roomCode: 'ABCDEF' });

    expect(res.status).toBe(404);
  });

  it('GIVEN user already a participant WHEN joining THEN 200 with current role (idempotent)', async () => {
    const user = await insertUser(db);
    const room = await insertRoom(db, user.id, { maxParticipants: 4 });
    await insertParticipant(db, room.id, user.id, 'interviewer');

    const res = await asUser(request(app.getHttpServer()).post(`/rooms/${room.id}/join`), user)
      .send({ roomCode: room.inviteCode })
      .expect(200);

    expect(res.body.assignedRole).toBe('interviewer');
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

describe('DELETE /rooms/:id/participants/:userId', () => {
  it('GIVEN host WHEN removing another participant THEN returns 204', async () => {
    const host = await insertUser(db);
    const target = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, target.id, 'candidate');

    const res = await asUser(
      request(app.getHttpServer()).delete(`/rooms/${room.id}/participants/${target.id}`),
      host,
    );

    expect(res.status).toBe(204);
  });

  it('GIVEN non-host WHEN removing a participant THEN returns 403', async () => {
    const host = await insertUser(db);
    const other = await insertUser(db);
    const target = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, other.id, 'observer');
    await insertParticipant(db, room.id, target.id, 'candidate');

    const res = await asUser(
      request(app.getHttpServer()).delete(`/rooms/${room.id}/participants/${target.id}`),
      other,
    );

    expect(res.status).toBe(403);
  });

  it('GIVEN host removing self WHEN requesting THEN returns 400', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer');

    const res = await asUser(
      request(app.getHttpServer()).delete(`/rooms/${room.id}/participants/${host.id}`),
      host,
    );

    expect(res.status).toBe(400);
  });

  it('GIVEN target participant missing WHEN removing THEN returns 404', async () => {
    const host = await insertUser(db);
    const ghost = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer');

    const res = await asUser(
      request(app.getHttpServer()).delete(`/rooms/${room.id}/participants/${ghost.id}`),
      host,
    );

    expect(res.status).toBe(404);
  });
});

describe('POST /rooms/:id/control/transition', () => {
  it('GIVEN valid next phase WHEN transitioning THEN returns ISO timestamp with updated statuses', async () => {
    const host = await insertUser(db);
    const candidate = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer', { isReady: true });
    await insertParticipant(db, room.id, candidate.id, 'candidate', { isReady: true });

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

describe('POST /rooms/:id/control/lock-editor', () => {
  it('GIVEN host WHEN locking editor THEN returns 200 with editorLocked=true, changed=true, and ISO timestamp', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer');

    const res = await asUser(
      request(app.getHttpServer()).post(`/rooms/${room.id}/control/lock-editor`),
      host,
    ).expect(200);

    expect(res.body).toMatchObject({
      roomId: room.id,
      editorLocked: true,
      changed: true,
      lockedBy: host.id,
    });
    expect(res.body.lockedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('GIVEN candidate WHEN locking editor THEN returns 403', async () => {
    const host = await insertUser(db);
    const candidate = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    const res = await asUser(
      request(app.getHttpServer()).post(`/rooms/${room.id}/control/lock-editor`),
      candidate,
    );

    expect(res.status).toBe(403);
  });

  it('GIVEN non-participant WHEN locking editor THEN returns 403', async () => {
    const host = await insertUser(db);
    const stranger = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer');

    const res = await asUser(
      request(app.getHttpServer()).post(`/rooms/${room.id}/control/lock-editor`),
      stranger,
    );

    expect(res.status).toBe(403);
  });

  it('GIVEN finished room WHEN locking editor THEN returns 409', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'finished' });
    await insertParticipant(db, room.id, host.id, 'interviewer');

    const res = await asUser(
      request(app.getHttpServer()).post(`/rooms/${room.id}/control/lock-editor`),
      host,
    );

    expect(res.status).toBe(409);
  });

  it('GIVEN already-locked room WHEN locking editor THEN is idempotent (200, changed=false, no timestamp)', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id, { editorLocked: true });
    await insertParticipant(db, room.id, host.id, 'interviewer');

    const res = await asUser(
      request(app.getHttpServer()).post(`/rooms/${room.id}/control/lock-editor`),
      host,
    ).expect(200);

    expect(res.body.editorLocked).toBe(true);
    expect(res.body.changed).toBe(false);
    expect(res.body.lockedAt).toBeUndefined();
    expect(res.body.lockedBy).toBeUndefined();
  });
});

describe('POST /rooms/:id/control/unlock-editor', () => {
  it('GIVEN locked room and host WHEN unlocking THEN returns 200 with editorLocked=false, changed=true, and ISO timestamp', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id, { editorLocked: true });
    await insertParticipant(db, room.id, host.id, 'interviewer');

    const res = await asUser(
      request(app.getHttpServer()).post(`/rooms/${room.id}/control/unlock-editor`),
      host,
    ).expect(200);

    expect(res.body).toMatchObject({
      roomId: room.id,
      editorLocked: false,
      changed: true,
      unlockedBy: host.id,
    });
    expect(res.body.unlockedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('GIVEN already-unlocked room WHEN unlocking THEN is idempotent (200, changed=false, no timestamp)', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer');

    const res = await asUser(
      request(app.getHttpServer()).post(`/rooms/${room.id}/control/unlock-editor`),
      host,
    ).expect(200);

    expect(res.body.editorLocked).toBe(false);
    expect(res.body.changed).toBe(false);
    expect(res.body.unlockedAt).toBeUndefined();
    expect(res.body.unlockedBy).toBeUndefined();
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

    const res = await asUser(request(app.getHttpServer()).delete(`/rooms/${room.id}`), other);

    expect(res.status).toBe(403);
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

    const res = await asUser(
      request(app.getHttpServer()).post(`/rooms/${room.id}/run`),
      observer,
    ).send({ language: 'python', code: 'print("hi")' });

    expect(res.status).toBe(403);
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

describe('POST /rooms/:id/ai/hint', () => {
  it('GIVEN participant with ai capability and selected problem WHEN requesting hint THEN returns 202 with generated hint', async () => {
    const interviewer = await insertUser(db);
    const candidate = await insertUser(db);
    const problem = await insertProblem(db);
    const room = await insertRoom(db, interviewer.id, {
      status: 'coding',
      problemId: problem.id,
      language: 'python',
    });
    await insertParticipant(db, room.id, interviewer.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    const res = await asUser(
      request(app.getHttpServer()).post(`/rooms/${room.id}/ai/hint`),
      candidate,
    )
      .send({
        code: 'print("hello")',
        language: 'python',
        hintLevel: 'subtle',
      })
      .expect(202);

    expect(res.body.jobId).toBe('ai-hint-job');
    expect(res.body.hintId).toEqual(expect.any(String));
    expect(res.body.phase).toBe('initial');

    const persisted = await db
      .select({ id: aiHints.id, hint: aiHints.hint })
      .from(aiHints)
      .where(eq(aiHints.id, res.body.hintId));
    expect(persisted).toHaveLength(1);
    expect(persisted[0]!.hint).toBe('');

    const result = await asUser(
      request(app.getHttpServer()).get(`/rooms/${room.id}/ai/hint/${res.body.jobId}`),
      candidate,
    ).expect(200);

    expect(result.body.status).toBe('ready');
    expect(result.body.hintId).toBe(res.body.hintId);
    expect(result.body.phase).toBe('initial');
    expect(result.body.hint).toEqual(expect.any(String));
  });

  it('GIVEN unknown jobId WHEN polling THEN returns 404', async () => {
    const interviewer = await insertUser(db);
    const candidate = await insertUser(db);
    const problem = await insertProblem(db);
    const room = await insertRoom(db, interviewer.id, {
      status: 'coding',
      problemId: problem.id,
      language: 'python',
    });
    await insertParticipant(db, room.id, interviewer.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    await asUser(
      request(app.getHttpServer()).get(`/rooms/${room.id}/ai/hint/missing-job`),
      candidate,
    ).expect(404);
  });

  it('GIVEN another user holds the job WHEN polling with wrong user THEN returns 404', async () => {
    const interviewer = await insertUser(db);
    const candidate = await insertUser(db);
    const intruder = await insertUser(db);
    const problem = await insertProblem(db);
    const room = await insertRoom(db, interviewer.id, {
      status: 'coding',
      problemId: problem.id,
      language: 'python',
    });
    await insertParticipant(db, room.id, interviewer.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');
    await insertParticipant(db, room.id, intruder.id, 'observer');

    const submission = await asUser(
      request(app.getHttpServer()).post(`/rooms/${room.id}/ai/hint`),
      candidate,
    )
      .send({ code: 'print("hi")', language: 'python', hintLevel: 'subtle' })
      .expect(202);

    await asUser(
      request(app.getHttpServer()).get(`/rooms/${room.id}/ai/hint/${submission.body.jobId}`),
      intruder,
    ).expect(404);
  });

  it('GIVEN request language mismatches active room language WHEN requesting hint THEN returns 400', async () => {
    const interviewer = await insertUser(db);
    const candidate = await insertUser(db);
    const problem = await insertProblem(db);
    const room = await insertRoom(db, interviewer.id, {
      status: 'coding',
      problemId: problem.id,
      language: 'python',
    });
    await insertParticipant(db, room.id, interviewer.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    await asUser(request(app.getHttpServer()).post(`/rooms/${room.id}/ai/hint`), candidate)
      .send({
        code: 'console.log("hello")',
        language: 'javascript',
        hintLevel: 'subtle',
      })
      .expect(400);
  });

  it('GIVEN existing hint WHEN requesting follow-up with no reply THEN returns follow-up without consuming a new hint row', async () => {
    const interviewer = await insertUser(db);
    const candidate = await insertUser(db);
    const problem = await insertProblem(db);
    const room = await insertRoom(db, interviewer.id, {
      status: 'coding',
      problemId: problem.id,
      language: 'python',
    });
    await insertParticipant(db, room.id, interviewer.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    const initial = await asUser(
      request(app.getHttpServer()).post(`/rooms/${room.id}/ai/hint`),
      candidate,
    )
      .send({
        code: 'print("hello")',
        language: 'python',
        hintLevel: 'subtle',
      })
      .expect(202);

    const beforeFollowUp = await db
      .select({ id: aiHints.id })
      .from(aiHints)
      .where(eq(aiHints.userId, candidate.id));

    const followUp = await asUser(
      request(app.getHttpServer()).post(`/rooms/${room.id}/ai/hint`),
      candidate,
    )
      .send({
        code: 'print("hello")',
        language: 'python',
        hintLevel: 'subtle',
        followUpToHintId: initial.body.hintId,
        noReply: true,
      })
      .expect(202);

    const afterFollowUp = await db
      .select({ id: aiHints.id })
      .from(aiHints)
      .where(eq(aiHints.userId, candidate.id));

    expect(followUp.body.hintId).toBe(initial.body.hintId);
    expect(followUp.body.phase).toBe('follow_up');
    expect(afterFollowUp.length).toBe(beforeFollowUp.length);
  });

  it('GIVEN observer WHEN requesting hint THEN returns 403', async () => {
    const interviewer = await insertUser(db);
    const observer = await insertUser(db);
    const problem = await insertProblem(db);
    const room = await insertRoom(db, interviewer.id, {
      status: 'coding',
      problemId: problem.id,
      language: 'python',
    });
    await insertParticipant(db, room.id, interviewer.id, 'interviewer');
    await insertParticipant(db, room.id, observer.id, 'observer');

    await asUser(request(app.getHttpServer()).post(`/rooms/${room.id}/ai/hint`), observer)
      .send({
        code: 'print("hello")',
        language: 'python',
        hintLevel: 'subtle',
      })
      .expect(403);
  });

  it('GIVEN 3 recent hints in the same room WHEN requesting hint THEN returns 429', async () => {
    const interviewer = await insertUser(db);
    const candidate = await insertUser(db);
    const problem = await insertProblem(db);
    const room = await insertRoom(db, interviewer.id, {
      status: 'coding',
      problemId: problem.id,
      language: 'python',
    });
    await insertParticipant(db, room.id, interviewer.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    await db.insert(aiHints).values([
      {
        roomId: room.id,
        userId: candidate.id,
        hint: 'hint 1',
        hintLevel: 'subtle',
      },
      {
        roomId: room.id,
        userId: candidate.id,
        hint: 'hint 2',
        hintLevel: 'subtle',
      },
      {
        roomId: room.id,
        userId: candidate.id,
        hint: 'hint 3',
        hintLevel: 'subtle',
      },
    ]);

    await asUser(request(app.getHttpServer()).post(`/rooms/${room.id}/ai/hint`), candidate)
      .send({
        code: 'print("hello")',
        language: 'python',
        hintLevel: 'subtle',
      })
      .expect(429);
  });
});

describe('POST /rooms/:id/ai/code-analysis', () => {
  async function createCodeAnalysisRoom(candidateRole: 'candidate' | 'observer' = 'candidate') {
    const interviewer = await insertUser(db);
    const candidate = await insertUser(db);
    const problem = await insertProblem(db);
    const room = await insertRoom(db, interviewer.id, {
      status: 'coding',
      problemId: problem.id,
      language: 'python',
    });
    await insertParticipant(db, room.id, interviewer.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, candidateRole);

    return { interviewer, candidate, problem, room };
  }

  it('GIVEN participant with ai capability and selected problem WHEN requesting analysis THEN submits current code snapshot and returns ready result', async () => {
    const { candidate, room } = await createCodeAnalysisRoom();
    mockAiClient.getCodeAnalysisResult.mockResolvedValueOnce({
      summary: 'The solution is close but should discuss complexity and edge cases.',
      focusAreas: {
        complexity: 'Explain why the lookup strategy is linear.',
        edgeCases: 'Cover empty inputs and duplicate values.',
        readability: 'Rename state variables to clarify intent.',
      },
      followUpQuestions: ['What is the complexity?', 'Which edge case matters most?'],
    });

    const res = await asUser(
      request(app.getHttpServer()).post(`/rooms/${room.id}/ai/code-analysis`),
      candidate,
    )
      .send({
        code: 'print("hello")',
        language: 'python',
      })
      .expect(202);

    expect(res.body.jobId).toBe('ai-code-analysis-job');
    const hintRowsAfterPost = await db
      .select({ id: aiHints.id })
      .from(aiHints)
      .where(eq(aiHints.userId, candidate.id));
    expect(hintRowsAfterPost).toHaveLength(0);
    expect(mockAiClient.submitCodeAnalysisRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: room.id,
        participantId: candidate.id,
        code: 'print("hello")',
        language: 'python',
      }),
    );

    const result = await asUser(
      request(app.getHttpServer()).get(`/rooms/${room.id}/ai/code-analysis/${res.body.jobId}`),
      candidate,
    ).expect(200);

    expect(result.body).toEqual({
      status: 'ready',
      jobId: res.body.jobId,
      summary: 'The solution is close but should discuss complexity and edge cases.',
      focusAreas: {
        complexity: 'Explain why the lookup strategy is linear.',
        edgeCases: 'Cover empty inputs and duplicate values.',
        readability: 'Rename state variables to clarify intent.',
      },
      followUpQuestions: ['What is the complexity?', 'Which edge case matters most?'],
    });

    const hintRowsAfterPoll = await db
      .select({ id: aiHints.id })
      .from(aiHints)
      .where(eq(aiHints.userId, candidate.id));
    expect(hintRowsAfterPoll).toHaveLength(0);
  });

  it('GIVEN another user holds the analysis job WHEN polling with wrong user THEN returns 404', async () => {
    const { candidate, room } = await createCodeAnalysisRoom();
    const intruder = await insertUser(db);
    await insertParticipant(db, room.id, intruder.id, 'observer');

    const submission = await asUser(
      request(app.getHttpServer()).post(`/rooms/${room.id}/ai/code-analysis`),
      candidate,
    )
      .send({ code: 'print("hi")', language: 'python' })
      .expect(202);

    const result = await asUser(
      request(app.getHttpServer()).get(
        `/rooms/${room.id}/ai/code-analysis/${submission.body.jobId}`,
      ),
      intruder,
    ).expect(404);

    expect(result.body.message).toBe('Code analysis job not found');
  });

  it('GIVEN request language mismatches active room language WHEN requesting analysis THEN returns 400', async () => {
    const { candidate, room } = await createCodeAnalysisRoom();

    const result = await asUser(
      request(app.getHttpServer()).post(`/rooms/${room.id}/ai/code-analysis`),
      candidate,
    )
      .send({
        code: 'console.log("hello")',
        language: 'javascript',
      })
      .expect(400);

    expect(result.body.message).toContain('Analysis language must match room language');
  });

  it('GIVEN oversized code snapshot WHEN requesting analysis THEN returns 400 before enqueueing', async () => {
    const { candidate, room } = await createCodeAnalysisRoom();

    const result = await asUser(
      request(app.getHttpServer()).post(`/rooms/${room.id}/ai/code-analysis`),
      candidate,
    )
      .send({
        code: 'x'.repeat(16_001),
        language: 'python',
      })
      .expect(400);

    expect(result.body.statusCode).toBe(400);
    expect(mockAiClient.submitCodeAnalysisRequest).not.toHaveBeenCalled();
  });

  it('GIVEN too many recent analysis requests WHEN requesting analysis THEN returns 429', async () => {
    const { candidate, room } = await createCodeAnalysisRoom();

    for (let i = 0; i < 10; i += 1) {
      await asUser(
        request(app.getHttpServer()).post(`/rooms/${room.id}/ai/code-analysis`),
        candidate,
      )
        .send({ code: `print(${i})`, language: 'python' })
        .expect(202);
    }

    const result = await asUser(
      request(app.getHttpServer()).post(`/rooms/${room.id}/ai/code-analysis`),
      candidate,
    )
      .send({ code: 'print("limited")', language: 'python' })
      .expect(429);

    expect(result.body.message).toBe('Code analysis rate limit exceeded (10 per 5 minutes)');
  });

  it('GIVEN observer WHEN requesting analysis THEN returns 403', async () => {
    const { candidate: observer, room } = await createCodeAnalysisRoom('observer');

    const result = await asUser(
      request(app.getHttpServer()).post(`/rooms/${room.id}/ai/code-analysis`),
      observer,
    )
      .send({
        code: 'print("hello")',
        language: 'python',
      })
      .expect(403);

    expect(result.body.message).toBe('No ai:request-hint capability');
  });
});

describe('POST /rooms/:id/ai/interview', () => {
  async function createAiInterviewRoom() {
    const candidate = await insertUser(db);
    const problem = await insertProblem(db);
    const room = await insertRoom(db, candidate.id, {
      mode: 'ai',
      status: 'coding',
      problemId: problem.id,
      language: 'python',
    });
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    return { candidate, problem, room };
  }

  it('GIVEN AI room candidate and selected problem WHEN requesting interview response THEN returns ready interview result', async () => {
    const { candidate, room } = await createAiInterviewRoom();
    mockAiClient.getInterviewResult.mockResolvedValueOnce({
      message: 'Explain why your hash map lookup is correct.',
      followUpQuestion: 'What happens with duplicate numbers?',
      codeAnnotations: [{ line: 3, comment: 'Mention how this handles repeated values.' }],
      audio: {
        audioKey: 'ai/interview/ai-interview-job.mp3',
        mimeType: 'audio/mpeg',
        downloadUrl: 'https://media.example.com/interview.mp3',
      },
    });

    const submission = await asUser(
      request(app.getHttpServer()).post(`/rooms/${room.id}/ai/interview`),
      candidate,
    )
      .send({
        userMessage: 'I would scan once and store complements.',
        conversationHistory: [{ role: 'assistant', content: 'How would you solve this?' }],
        currentCode: 'def two_sum(nums, target):\n    return []',
      })
      .expect(202);

    expect(submission.body.jobId).toBe('ai-interview-job');
    expect(mockAiClient.submitInterviewResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: room.id,
        participantId: candidate.id,
        language: 'python',
        userMessage: 'I would scan once and store complements.',
        conversationHistory: [{ role: 'assistant', content: 'How would you solve this?' }],
      }),
    );

    const result = await asUser(
      request(app.getHttpServer()).get(`/rooms/${room.id}/ai/interview/${submission.body.jobId}`),
      candidate,
    ).expect(200);

    expect(result.body).toEqual({
      status: 'ready',
      jobId: submission.body.jobId,
      message: 'Explain why your hash map lookup is correct.',
      followUpQuestion: 'What happens with duplicate numbers?',
      codeAnnotations: [{ line: 3, comment: 'Mention how this handles repeated values.' }],
      audioUrl: 'https://media.example.com/interview.mp3',
    });
  });

  it('GIVEN peer room WHEN requesting interview response THEN returns ROOM_NOT_AI_MODE', async () => {
    const interviewer = await insertUser(db);
    const candidate = await insertUser(db);
    const problem = await insertProblem(db);
    const room = await insertRoom(db, interviewer.id, {
      mode: 'peer',
      status: 'coding',
      problemId: problem.id,
      language: 'python',
    });
    await insertParticipant(db, room.id, interviewer.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    const result = await asUser(
      request(app.getHttpServer()).post(`/rooms/${room.id}/ai/interview`),
      candidate,
    )
      .send({
        userMessage: 'Can we do an AI interview here?',
        conversationHistory: [],
        currentCode: 'print("hello")',
      })
      .expect(400);

    expect(result.body.code).toBe(ERROR_CODES.ROOM_NOT_AI_MODE);
    expect(mockAiClient.submitInterviewResponse).not.toHaveBeenCalled();
  });

  it('GIVEN another participant owns interview job WHEN polling with wrong user THEN returns 404', async () => {
    const { candidate, room } = await createAiInterviewRoom();
    const intruder = await insertUser(db);
    await insertParticipant(db, room.id, intruder.id, 'observer');

    const submission = await asUser(
      request(app.getHttpServer()).post(`/rooms/${room.id}/ai/interview`),
      candidate,
    )
      .send({
        userMessage: 'I would use two pointers.',
        conversationHistory: [],
        currentCode: 'print("hello")',
      })
      .expect(202);

    const result = await asUser(
      request(app.getHttpServer()).get(`/rooms/${room.id}/ai/interview/${submission.body.jobId}`),
      intruder,
    ).expect(404);

    expect(result.body.message).toBe('Interview job not found');
  });
});

describe('POST /rooms/:id/chat/media/upload-url', () => {
  it('GIVEN valid file metadata WHEN requesting upload URL THEN returns 201 with key and URLs', async () => {
    const interviewer = await insertUser(db);
    const candidate = await insertUser(db);
    const room = await insertRoom(db, interviewer.id, { status: 'coding' });
    await insertParticipant(db, room.id, interviewer.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    const res = await asUser(
      request(app.getHttpServer()).post(`/rooms/${room.id}/chat/media/upload-url`),
      candidate,
    )
      .send({
        fileName: 'screenshot.png',
        contentType: 'image/png',
        sizeBytes: 123_456,
      })
      .expect(201);

    expect(res.body.key).toContain(`rooms/${room.id}/chat/`);
    expect(res.body.uploadUrl).toBeTruthy();
    expect(res.body.downloadUrl).toBeTruthy();
    expect(res.body.contentType).toBe('image/png');
  });

  it('GIVEN unsupported content type WHEN requesting upload URL THEN returns 400', async () => {
    const interviewer = await insertUser(db);
    const candidate = await insertUser(db);
    const room = await insertRoom(db, interviewer.id, { status: 'coding' });
    await insertParticipant(db, room.id, interviewer.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    await asUser(
      request(app.getHttpServer()).post(`/rooms/${room.id}/chat/media/upload-url`),
      candidate,
    )
      .send({
        fileName: 'evil.exe',
        contentType: 'application/x-msdownload',
        sizeBytes: 42,
      })
      .expect(400);
  });
});

describe('POST /rooms/:id/collab/ensure', () => {
  it('GIVEN malformed room id WHEN ensuring collab THEN returns 400 instead of reaching storage', async () => {
    const user = await insertUser(db);

    const res = await asUser(
      request(app.getHttpServer()).post('/rooms/not-a-uuid/collab/ensure'),
      user,
    );

    expect(res.status).toBe(400);
    expect(res.body.statusCode).toBe(400);
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

    const res = await asUser(
      request(app.getHttpServer()).post(`/rooms/${room.id}/media/token`),
      observer,
    );

    expect(res.status).toBe(403);
  });

  it('GIVEN user is not a participant WHEN generating token THEN returns 403', async () => {
    const host = await insertUser(db);
    const stranger = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'coding' });
    await insertParticipant(db, room.id, host.id, 'interviewer');

    const res = await asUser(
      request(app.getHttpServer()).post(`/rooms/${room.id}/media/token`),
      stranger,
    );

    expect(res.status).toBe(403);
  });

  it('GIVEN room is finished WHEN generating token THEN returns 403', async () => {
    const user = await insertUser(db);
    const room = await insertRoom(db, user.id, { status: 'finished' });
    await insertParticipant(db, room.id, user.id, 'interviewer');

    const res = await asUser(
      request(app.getHttpServer()).post(`/rooms/${room.id}/media/token`),
      user,
    );

    expect(res.status).toBe(403);
  });

  it('GIVEN room does not exist WHEN generating token THEN returns 404', async () => {
    const user = await insertUser(db);

    const res = await asUser(
      request(app.getHttpServer()).post('/rooms/00000000-0000-0000-0000-000000000000/media/token'),
      user,
    );

    expect(res.status).toBe(404);
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

    const res = await asUser(
      request(app.getHttpServer()).patch(`/rooms/${room.id}/language`),
      observer,
    ).send({ language: 'javascript' });

    expect(res.status).toBe(403);
  });

  it('GIVEN invalid language in body WHEN PATCH THEN 400', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'coding', language: 'python' });
    await insertParticipant(db, room.id, host.id, 'interviewer');

    const res = await asUser(
      request(app.getHttpServer()).patch(`/rooms/${room.id}/language`),
      host,
    ).send({ language: 'brainfuck' });

    expect(res.status).toBe(400);
  });

  it('GIVEN non-member WHEN PATCH THEN 403', async () => {
    const host = await insertUser(db);
    const stranger = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'coding', language: 'python' });
    await insertParticipant(db, room.id, host.id, 'interviewer');

    const res = await asUser(
      request(app.getHttpServer()).patch(`/rooms/${room.id}/language`),
      stranger,
    ).send({ language: 'javascript' });

    expect(res.status).toBe(403);
  });

  it('GIVEN unauthenticated WHEN PATCH THEN 401', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'coding', language: 'python' });
    await insertParticipant(db, room.id, host.id, 'interviewer');

    const res = await request(app.getHttpServer())
      .patch(`/rooms/${room.id}/language`)
      .send({ language: 'javascript' });

    expect(res.status).toBe(401);
  });
});
