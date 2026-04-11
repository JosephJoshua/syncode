import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { COLLAB_CLIENT, EXECUTION_CLIENT } from '@syncode/contracts';
import type { Database } from '@syncode/db';
import { MEDIA_SERVICE, STORAGE_SERVICE } from '@syncode/shared/ports';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard.js';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import {
  createTestDb,
  insertParticipant,
  insertProblem,
  insertRoom,
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

beforeEach(async () => {
  vi.clearAllMocks();

  const testDb = await createTestDb();
  db = testDb.db;
  cleanup = testDb.cleanup;

  const module = await Test.createTestingModule({
    controllers: [RoomsController],
    providers: [
      RoomsService,
      { provide: DB_CLIENT, useValue: db },
      { provide: EXECUTION_CLIENT, useValue: createMockExecutionClient() },
      { provide: COLLAB_CLIENT, useValue: createMockCollabClient() },
      { provide: MEDIA_SERVICE, useValue: createMockMediaService() },
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
      .expect(201);

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
  it('GIVEN coding room with problem WHEN submitting THEN returns per-test-case results', async () => {
    const host = await insertUser(db);
    const candidate = await insertUser(db);
    const problem = await insertProblem(db);
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
      .send({
        language: 'python',
        code: 'print(input())',
        testCases: [{ input: '5', expectedOutput: '5' }],
      })
      .expect(201);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].testCaseIndex).toBe(0);
    expect(res.body[0].jobId).toBe('stub-job');
  });
});
