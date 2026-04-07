import type { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { Database } from '@syncode/db';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { DB_CLIENT } from '@/modules/db/db.module';
import {
  createTestDb,
  insertProblem,
  insertRoom,
  insertRun,
  insertSession,
  insertSessionParticipant,
  insertSessionReport,
  insertSubmission,
  insertUser,
} from '@/test/integration-setup';
import { asUser, TestAuthGuard } from '@/test/mock-factories';
import { SessionsController } from './sessions.controller.js';
import { SessionsService } from './sessions.service.js';

let app: INestApplication;
let db: Database;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  const testDb = await createTestDb();
  db = testDb.db;
  cleanup = testDb.cleanup;

  const module = await Test.createTestingModule({
    controllers: [SessionsController],
    providers: [SessionsService, { provide: DB_CLIENT, useValue: db }, Reflector],
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

describe('GET /sessions', () => {
  it('GIVEN finished sessions WHEN listing THEN returns paginated response with ISO timestamps', async () => {
    const user = await insertUser(db);
    const problem = await insertProblem(db);
    const room = await insertRoom(db, user.id);
    const session = await insertSession(db, room.id, { problemId: problem.id });
    await insertSessionParticipant(db, session.id, user.id);

    const res = await asUser(request(app.getHttpServer()).get('/sessions'), user).expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].sessionId).toBe(session.id);
    expect(res.body.data[0].problemTitle).toBe(problem.title);
    expect(res.body.data[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(res.body.pagination).toEqual({ nextCursor: null, hasMore: false });
  });

  it('GIVEN no sessions WHEN listing THEN returns empty data', async () => {
    const user = await insertUser(db);

    const res = await asUser(request(app.getHttpServer()).get('/sessions'), user).expect(200);

    expect(res.body.data).toHaveLength(0);
    expect(res.body.pagination).toEqual({ nextCursor: null, hasMore: false });
  });
});

describe('GET /sessions/:id', () => {
  it('GIVEN participant WHEN getting session THEN returns detail with ISO timestamps', async () => {
    const user = await insertUser(db);
    const problem = await insertProblem(db);
    const room = await insertRoom(db, user.id);
    const session = await insertSession(db, room.id, {
      problemId: problem.id,
      durationMs: 3600000,
      language: 'python',
    });
    await insertSessionParticipant(db, session.id, user.id, 'host');
    await insertSessionReport(db, session.id);
    await insertRun(db, room.id, user.id, { status: 'completed' });
    await insertSubmission(db, room.id, user.id, problem.id, { status: 'completed' });

    const res = await asUser(
      request(app.getHttpServer()).get(`/sessions/${session.id}`),
      user,
    ).expect(200);

    expect(res.body.sessionId).toBe(session.id);
    expect(res.body.problem.title).toBe(problem.title);
    expect(res.body.duration).toBe(3600);
    expect(res.body.language).toBe('python');
    expect(res.body.hasReport).toBe(true);
    expect(res.body.participants).toHaveLength(1);
    expect(res.body.participants[0].joinedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(res.body.runs).toHaveLength(1);
    expect(res.body.runs[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(res.body.submissions).toHaveLength(1);
    expect(res.body.submissions[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(res.body.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('GIVEN non-participant WHEN getting session THEN returns 403', async () => {
    const owner = await insertUser(db);
    const stranger = await insertUser(db);
    const room = await insertRoom(db, owner.id);
    const session = await insertSession(db, room.id);
    await insertSessionParticipant(db, session.id, owner.id);

    await asUser(request(app.getHttpServer()).get(`/sessions/${session.id}`), stranger).expect(403);
  });

  it('GIVEN non-existent session WHEN getting THEN returns 404', async () => {
    const user = await insertUser(db);

    await asUser(
      request(app.getHttpServer()).get('/sessions/00000000-0000-0000-0000-000000000000'),
      user,
    ).expect(404);
  });
});

describe('DELETE /sessions/:id', () => {
  it('GIVEN participant WHEN deleting session THEN returns 204', async () => {
    const user = await insertUser(db);
    const room = await insertRoom(db, user.id);
    const session = await insertSession(db, room.id);
    await insertSessionParticipant(db, session.id, user.id);

    await asUser(request(app.getHttpServer()).delete(`/sessions/${session.id}`), user).expect(204);
  });

  it('GIVEN non-participant WHEN deleting session THEN returns 403', async () => {
    const owner = await insertUser(db);
    const stranger = await insertUser(db);
    const room = await insertRoom(db, owner.id);
    const session = await insertSession(db, room.id);
    await insertSessionParticipant(db, session.id, owner.id);

    await asUser(request(app.getHttpServer()).delete(`/sessions/${session.id}`), stranger).expect(
      403,
    );
  });

  it('GIVEN non-existent session WHEN deleting THEN returns 404', async () => {
    const user = await insertUser(db);

    await asUser(
      request(app.getHttpServer()).delete('/sessions/00000000-0000-0000-0000-000000000000'),
      user,
    ).expect(404);
  });
});
