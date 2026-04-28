import type { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AI_CLIENT } from '@syncode/contracts';
import type { Database } from '@syncode/db';
import { CACHE_SERVICE, STORAGE_SERVICE } from '@syncode/shared/ports';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard.js';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import { SessionReportRequestBuilderService } from '@/modules/sessions/session-report-request-builder.service.js';
import { SessionReportsService } from '@/modules/sessions/session-reports.service.js';
import { InMemoryCacheService } from '@/test/in-memory-cache.service.js';
import {
  createTestDb,
  insertCodeSnapshot,
  insertProblem,
  insertRoom,
  insertRun,
  insertSession,
  insertSessionParticipant,
  insertSessionReport,
  insertSubmission,
  insertUser,
} from '@/test/integration-setup.js';
import {
  asUser,
  createMockAiClient,
  createMockStorageService,
  TestAuthGuard,
} from '@/test/mock-factories.js';
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
    providers: [
      SessionsService,
      SessionReportRequestBuilderService,
      SessionReportsService,
      { provide: DB_CLIENT, useValue: db },
      { provide: AI_CLIENT, useValue: createMockAiClient() },
      { provide: CACHE_SERVICE, useValue: new InMemoryCacheService() },
      { provide: STORAGE_SERVICE, useValue: createMockStorageService() },
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

describe('GET /sessions/:sessionId/snapshots', () => {
  it('GIVEN participant WHEN getting snapshots THEN returns stored triggers and ISO timestamps', async () => {
    const user = await insertUser(db);
    const room = await insertRoom(db, user.id);
    const session = await insertSession(db, room.id, {
      status: 'ongoing',
      language: 'python',
    });
    await insertSessionParticipant(db, session.id, user.id);

    await insertCodeSnapshot(db, {
      sessionId: session.id,
      roomId: room.id,
      code: 'print("first")',
      language: 'python',
      trigger: 'submission',
      linesOfCode: 1,
      createdAt: new Date('2026-04-18T10:00:00.000Z'),
    });
    await insertCodeSnapshot(db, {
      sessionId: session.id,
      roomId: room.id,
      code: 'print("second")',
      language: 'python',
      trigger: 'periodic',
      linesOfCode: 1,
      createdAt: new Date('2026-04-18T10:01:00.000Z'),
    });

    const res = await asUser(
      request(app.getHttpServer()).get(`/sessions/${session.id}/snapshots`),
      user,
    ).expect(200);

    expect(res.body).toEqual({
      data: [
        expect.objectContaining({
          trigger: 'submission',
          language: 'python',
          code: 'print("first")',
          linesOfCode: 1,
          timestamp: '2026-04-18T10:00:00.000Z',
        }),
        expect.objectContaining({
          trigger: 'periodic',
          language: 'python',
          code: 'print("second")',
          linesOfCode: 1,
          timestamp: '2026-04-18T10:01:00.000Z',
        }),
      ],
      pagination: { nextCursor: null, hasMore: false },
    });
  });

  it('GIVEN non-participant WHEN getting snapshots THEN returns 403', async () => {
    const owner = await insertUser(db);
    const stranger = await insertUser(db);
    const room = await insertRoom(db, owner.id);
    const session = await insertSession(db, room.id, { language: 'python' });
    await insertSessionParticipant(db, session.id, owner.id);

    const res = await asUser(
      request(app.getHttpServer()).get(`/sessions/${session.id}/snapshots`),
      stranger,
    );

    expect(res.status).toBe(403);
  });

  it('GIVEN non-existent session WHEN getting snapshots THEN returns 404', async () => {
    const user = await insertUser(db);

    const res = await asUser(
      request(app.getHttpServer()).get('/sessions/00000000-0000-0000-0000-000000000000/snapshots'),
      user,
    );

    expect(res.status).toBe(404);
  });

  it('GIVEN malformed session id WHEN getting snapshots THEN returns 400', async () => {
    const user = await insertUser(db);

    const res = await asUser(
      request(app.getHttpServer()).get('/sessions/{sessionId}/snapshots'),
      user,
    );

    expect(res.status).toBe(400);
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
    await insertSessionParticipant(db, session.id, user.id, 'interviewer');
    await insertSessionReport(db, session.id);
    await insertRun(db, room.id, user.id, { status: 'completed' });
    await insertSubmission(db, user.id, room.id, problem.id, { status: 'completed' });

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

    const res = await asUser(request(app.getHttpServer()).get(`/sessions/${session.id}`), stranger);

    expect(res.status).toBe(403);
  });

  it('GIVEN non-existent session WHEN getting THEN returns 404', async () => {
    const user = await insertUser(db);

    const res = await asUser(
      request(app.getHttpServer()).get('/sessions/00000000-0000-0000-0000-000000000000'),
      user,
    );

    expect(res.status).toBe(404);
  });
});

describe('GET /sessions/:sessionId/report', () => {
  it('GIVEN participant with completed report WHEN getting report THEN returns report body', async () => {
    const user = await insertUser(db);
    const room = await insertRoom(db, user.id);
    const session = await insertSession(db, room.id);
    await insertSessionParticipant(db, session.id, user.id);
    await insertSessionReport(db, session.id, {
      userId: user.id,
      report: {
        sessionId: session.id,
        generatedAt: '2026-04-20T05:00:00.000Z',
        overallScore: 88,
        dimensions: {
          correctness: {
            score: 90,
            feedback: 'Strong correctness',
            evidence: [],
          },
        },
        strengths: ['Good test coverage'],
        areasForImprovement: ['Explain optimizations'],
        detailedFeedback: 'Detailed feedback',
        comparisonToHistory: null,
        peerFeedbackSummary: null,
        testCaseBreakdown: [],
      },
    });

    const res = await asUser(
      request(app.getHttpServer()).get(`/sessions/${session.id}/report`),
      user,
    ).expect(200);

    expect(res.body.sessionId).toBe(session.id);
    expect(res.body.overallScore).toBe(88);
    expect(res.body.generatedAt).toBe('2026-04-20T05:00:00.000Z');
  });

  it('GIVEN non-participant WHEN getting report THEN returns 403', async () => {
    const owner = await insertUser(db);
    const stranger = await insertUser(db);
    const room = await insertRoom(db, owner.id);
    const session = await insertSession(db, room.id);
    await insertSessionParticipant(db, session.id, owner.id);

    await asUser(
      request(app.getHttpServer()).get(`/sessions/${session.id}/report`),
      stranger,
    ).expect(403);
  });

  it('GIVEN report missing WHEN getting report THEN returns 404', async () => {
    const user = await insertUser(db);
    const room = await insertRoom(db, user.id);
    const session = await insertSession(db, room.id);
    await insertSessionParticipant(db, session.id, user.id);

    await asUser(request(app.getHttpServer()).get(`/sessions/${session.id}/report`), user).expect(
      404,
    );
  });
});

describe('DELETE /sessions/:id', () => {
  it('GIVEN participant WHEN deleting session THEN returns 204', async () => {
    const user = await insertUser(db);
    const room = await insertRoom(db, user.id);
    const session = await insertSession(db, room.id);
    await insertSessionParticipant(db, session.id, user.id);

    const res = await asUser(request(app.getHttpServer()).delete(`/sessions/${session.id}`), user);

    expect(res.status).toBe(204);
  });

  it('GIVEN non-participant WHEN deleting session THEN returns 403', async () => {
    const owner = await insertUser(db);
    const stranger = await insertUser(db);
    const room = await insertRoom(db, owner.id);
    const session = await insertSession(db, room.id);
    await insertSessionParticipant(db, session.id, owner.id);

    const res = await asUser(
      request(app.getHttpServer()).delete(`/sessions/${session.id}`),
      stranger,
    );

    expect(res.status).toBe(403);
  });

  it('GIVEN non-existent session WHEN deleting THEN returns 404', async () => {
    const user = await insertUser(db);

    const res = await asUser(
      request(app.getHttpServer()).delete('/sessions/00000000-0000-0000-0000-000000000000'),
      user,
    );

    expect(res.status).toBe(404);
  });
});
