import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ERROR_CODES } from '@syncode/contracts';
import type { Database } from '@syncode/db';
import { sessionDeletions } from '@syncode/db';
import { STORAGE_SERVICE } from '@syncode/shared/ports';
import { and, eq } from 'drizzle-orm';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import {
  createTestDb,
  insertPeerFeedbackRow,
  insertProblem,
  insertRoom,
  insertRun,
  insertSession,
  insertSessionDeletion,
  insertSessionParticipant,
  insertSessionRecording,
  insertSessionReport,
  insertSubmission,
  insertUser,
} from '@/test/integration-setup.js';
import { createMockStorageService } from '@/test/mock-factories.js';
import { SessionsService } from './sessions.service.js';

let db: Database;
let cleanup: () => Promise<void>;
let service: SessionsService;

beforeEach(async () => {
  const testDb = await createTestDb();
  db = testDb.db;
  cleanup = testDb.cleanup;

  const module = await Test.createTestingModule({
    providers: [
      SessionsService,
      { provide: DB_CLIENT, useValue: db },
      { provide: STORAGE_SERVICE, useValue: createMockStorageService() },
    ],
  }).compile();

  service = module.get(SessionsService);
});

afterEach(async () => {
  await cleanup();
});

const BASE_QUERY = { limit: 20, sortBy: 'createdAt' as const, sortOrder: 'desc' as const };

/**
 * Creates a finished session with a room, host participant, and session participant.
 * Returns the user, room, and session rows.
 */
async function seedFinishedSession(
  overrides: {
    sessionOverrides?: Parameters<typeof insertSession>[2];
    problemId?: string;
    userId?: string;
  } = {},
) {
  const user = overrides.userId ? { id: overrides.userId } : await insertUser(db);

  const room = await insertRoom(db, user.id);
  const session = await insertSession(db, room.id, {
    problemId: overrides.problemId ?? null,
    ...overrides.sessionOverrides,
  });
  await insertSessionParticipant(db, session.id, user.id);

  return { user, room, session };
}

describe('listSessions', () => {
  it('GIVEN sessions with problems and participants WHEN listing THEN returns correct joins and fields', async () => {
    const user = await insertUser(db);
    const otherUser = await insertUser(db);
    const problem = await insertProblem(db);

    const room = await insertRoom(db, user.id);
    const session = await insertSession(db, room.id, {
      problemId: problem.id,
      durationMs: 3600000,
    });
    await insertSessionParticipant(db, session.id, user.id, 'host');
    await insertSessionParticipant(db, session.id, otherUser.id, 'candidate');
    await insertSessionReport(db, session.id, { overallScore: 85 });

    const result = await service.listSessions(user.id, BASE_QUERY, false);

    expect(result.data).toHaveLength(1);
    const s = result.data[0];
    expect(s.sessionId).toBe(session.id);
    expect(s.problemTitle).toBe(problem.title);
    expect(s.difficulty).toBe(problem.difficulty);
    expect(s.duration).toBe(3600);
    expect(s.overallScore).toBe(85);
    expect(s.hasReport).toBe(true);
    expect(s.participants).toHaveLength(2);
    expect(s.participants.map((p) => p.userId)).toContain(user.id);
    expect(s.participants.map((p) => p.userId)).toContain(otherUser.id);
  });

  it('GIVEN 5 sessions WHEN paginating with limit=2 THEN traverses all pages without gaps or duplicates', async () => {
    const user = await insertUser(db);

    for (let i = 0; i < 5; i++) {
      const room = await insertRoom(db, user.id);
      const session = await insertSession(db, room.id, {
        startedAt: new Date(`2026-01-0${i + 1}T00:00:00Z`),
      });
      await insertSessionParticipant(db, session.id, user.id);
    }

    const query = { limit: 2, sortBy: 'createdAt' as const, sortOrder: 'desc' as const };

    const page1 = await service.listSessions(user.id, query, false);
    expect(page1.data).toHaveLength(2);
    expect(page1.pagination.hasMore).toBe(true);

    const page2 = await service.listSessions(
      user.id,
      { ...query, cursor: page1.pagination.nextCursor! },
      false,
    );
    expect(page2.data).toHaveLength(2);
    expect(page2.pagination.hasMore).toBe(true);

    const page3 = await service.listSessions(
      user.id,
      { ...query, cursor: page2.pagination.nextCursor! },
      false,
    );
    expect(page3.data).toHaveLength(1);
    expect(page3.pagination.hasMore).toBe(false);
    expect(page3.pagination.nextCursor).toBeNull();

    const allIds = [...page1.data, ...page2.data, ...page3.data].map((r) => r.sessionId);
    expect(new Set(allIds).size).toBe(5);
  });

  it('GIVEN sessions with mixed modes WHEN filtering by mode THEN returns only matching', async () => {
    const user = await insertUser(db);

    const r1 = await insertRoom(db, user.id);
    const s1 = await insertSession(db, r1.id, { mode: 'peer' });
    await insertSessionParticipant(db, s1.id, user.id);

    const r2 = await insertRoom(db, user.id);
    const s2 = await insertSession(db, r2.id, { mode: 'ai' });
    await insertSessionParticipant(db, s2.id, user.id);

    const result = await service.listSessions(user.id, { ...BASE_QUERY, mode: 'peer' }, false);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].mode).toBe('peer');
  });

  it('GIVEN soft-deleted session WHEN listing THEN excludes it for non-admin', async () => {
    const user = await insertUser(db);

    const r1 = await insertRoom(db, user.id);
    const s1 = await insertSession(db, r1.id);
    await insertSessionParticipant(db, s1.id, user.id);

    const r2 = await insertRoom(db, user.id);
    const s2 = await insertSession(db, r2.id);
    await insertSessionParticipant(db, s2.id, user.id);
    await insertSessionDeletion(db, s2.id, user.id);

    const result = await service.listSessions(user.id, BASE_QUERY, false);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].sessionId).toBe(s1.id);
  });

  it('GIVEN admin WHEN listing THEN sees all finished sessions regardless of participation', async () => {
    const admin = await insertUser(db, { role: 'admin' });
    const otherUser = await insertUser(db);

    // Session where admin is NOT a participant
    const room = await insertRoom(db, otherUser.id);
    const session = await insertSession(db, room.id);
    await insertSessionParticipant(db, session.id, otherUser.id);

    const result = await service.listSessions(admin.id, BASE_QUERY, true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].sessionId).toBe(session.id);
  });

  it('GIVEN non-finished sessions WHEN listing THEN excludes them', async () => {
    const user = await insertUser(db);

    const r1 = await insertRoom(db, user.id);
    const s1 = await insertSession(db, r1.id, { status: 'ongoing' });
    await insertSessionParticipant(db, s1.id, user.id);

    const r2 = await insertRoom(db, user.id);
    const s2 = await insertSession(db, r2.id, { status: 'finished' });
    await insertSessionParticipant(db, s2.id, user.id);

    const result = await service.listSessions(user.id, BASE_QUERY, false);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].sessionId).toBe(s2.id);
  });

  it('GIVEN sessions with date range WHEN filtering by fromDate/toDate THEN returns matching', async () => {
    const user = await insertUser(db);

    const dates = ['2026-01-01', '2026-02-01', '2026-03-01'];
    for (const d of dates) {
      const room = await insertRoom(db, user.id);
      const session = await insertSession(db, room.id, {
        startedAt: new Date(`${d}T00:00:00Z`),
      });
      await insertSessionParticipant(db, session.id, user.id);
    }

    const result = await service.listSessions(
      user.id,
      { ...BASE_QUERY, fromDate: '2026-01-15T00:00:00Z', toDate: '2026-02-15T00:00:00Z' },
      false,
    );
    expect(result.data).toHaveLength(1);
  });

  it('GIVEN sessions sorted by overallScore WHEN some have null scores THEN paginates correctly with nulls last', async () => {
    const user = await insertUser(db);

    // Session with score 90
    const r1 = await insertRoom(db, user.id);
    const s1 = await insertSession(db, r1.id);
    await insertSessionParticipant(db, s1.id, user.id);
    await insertSessionReport(db, s1.id, { overallScore: 90 });

    // Session with score 70
    const r2 = await insertRoom(db, user.id);
    const s2 = await insertSession(db, r2.id);
    await insertSessionParticipant(db, s2.id, user.id);
    await insertSessionReport(db, s2.id, { overallScore: 70 });

    // Session with no report (null score)
    const r3 = await insertRoom(db, user.id);
    const s3 = await insertSession(db, r3.id);
    await insertSessionParticipant(db, s3.id, user.id);

    const result = await service.listSessions(
      user.id,
      { ...BASE_QUERY, sortBy: 'overallScore', sortOrder: 'desc' },
      false,
    );

    expect(result.data).toHaveLength(3);
    // Desc: 90, 70, null
    expect(result.data[0].overallScore).toBe(90);
    expect(result.data[1].overallScore).toBe(70);
    expect(result.data[2].overallScore).toBeNull();
  });

  it('GIVEN sessions sorted by duration WHEN paginating THEN cursor works with ms/s conversion', async () => {
    const user = await insertUser(db);

    const durations = [60000, 120000, 180000]; // 60s, 120s, 180s
    for (const ms of durations) {
      const room = await insertRoom(db, user.id);
      const session = await insertSession(db, room.id, { durationMs: ms });
      await insertSessionParticipant(db, session.id, user.id);
    }

    const query = {
      limit: 2,
      sortBy: 'duration' as const,
      sortOrder: 'desc' as const,
    };

    const page1 = await service.listSessions(user.id, query, false);
    expect(page1.data).toHaveLength(2);
    expect(page1.data[0].duration).toBe(180);
    expect(page1.data[1].duration).toBe(120);
    expect(page1.pagination.hasMore).toBe(true);

    const page2 = await service.listSessions(
      user.id,
      { ...query, cursor: page1.pagination.nextCursor! },
      false,
    );
    expect(page2.data).toHaveLength(1);
    expect(page2.data[0].duration).toBe(60);
    expect(page2.pagination.hasMore).toBe(false);
  });

  it('GIVEN hasFeedback flag WHEN session has peer feedback THEN returns true', async () => {
    const user1 = await insertUser(db);
    const user2 = await insertUser(db);

    const room = await insertRoom(db, user1.id);
    const session = await insertSession(db, room.id);
    await insertSessionParticipant(db, session.id, user1.id);
    await insertSessionParticipant(db, session.id, user2.id);
    await insertPeerFeedbackRow(db, {
      sessionId: session.id,
      roomId: room.id,
      reviewerId: user1.id,
      candidateId: user2.id,
    });

    const result = await service.listSessions(user1.id, BASE_QUERY, false);
    expect(result.data[0].hasFeedback).toBe(true);
  });
});

describe('getSession', () => {
  it('GIVEN session with all related data WHEN getting detail THEN returns complete result', async () => {
    const user1 = await insertUser(db);
    const user2 = await insertUser(db);
    const problem = await insertProblem(db);

    const room = await insertRoom(db, user1.id);
    const session = await insertSession(db, room.id, {
      problemId: problem.id,
      durationMs: 5400000,
      language: 'python',
    });
    await insertSessionParticipant(db, session.id, user1.id, 'host');
    await insertSessionParticipant(db, session.id, user2.id, 'candidate');
    await insertSessionReport(db, session.id);
    await insertSessionRecording(db, session.id);
    await insertPeerFeedbackRow(db, {
      sessionId: session.id,
      roomId: room.id,
      reviewerId: user1.id,
      candidateId: user2.id,
    });

    const completedRun = await insertRun(db, room.id, user1.id, { status: 'completed' });
    await insertRun(db, room.id, user1.id, { status: 'pending' }); // should be filtered out
    const completedSub = await insertSubmission(db, user1.id, room.id, problem.id, {
      status: 'completed',
    });
    await insertSubmission(db, user1.id, room.id, problem.id, { status: 'running' }); // filtered out

    const result = await service.getSession(session.id, user1.id, false);

    expect(result.sessionId).toBe(session.id);
    expect(result.roomId).toBe(room.id);
    expect(result.mode).toBe('peer');
    expect(result.language).toBe('python');
    expect(result.duration).toBe(5400);
    expect(result.problem).toMatchObject({ id: problem.id, title: problem.title });
    expect(result.participants).toHaveLength(2);
    expect(result.hasReport).toBe(true);
    expect(result.hasFeedback).toBe(true);
    expect(result.hasRecording).toBe(true);

    // Only terminal runs/submissions
    expect(result.runs).toHaveLength(1);
    expect(result.runs[0].jobId).toBe(completedRun.jobId);
    expect(result.submissions).toHaveLength(1);
    expect(result.submissions[0].submissionId).toBe(completedSub.id);
  });

  it('GIVEN non-participant WHEN getSession THEN throws ForbiddenException', async () => {
    const { session } = await seedFinishedSession();
    const stranger = await insertUser(db);

    await expect(service.getSession(session.id, stranger.id, false)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('GIVEN soft-deleted session WHEN non-admin getSession THEN throws NotFoundException', async () => {
    const user = await insertUser(db);
    const room = await insertRoom(db, user.id);
    const session = await insertSession(db, room.id);
    await insertSessionParticipant(db, session.id, user.id);
    await insertSessionDeletion(db, session.id, user.id);

    await expect(service.getSession(session.id, user.id, false)).rejects.toThrow(NotFoundException);
  });

  it('GIVEN admin WHEN getSession for non-participated session THEN returns detail', async () => {
    const admin = await insertUser(db, { role: 'admin' });
    const { session } = await seedFinishedSession();

    const result = await service.getSession(session.id, admin.id, true);
    expect(result.sessionId).toBe(session.id);
  });

  it('GIVEN ongoing session WHEN getSession THEN throws NotFoundException', async () => {
    const user = await insertUser(db);
    const room = await insertRoom(db, user.id);
    const session = await insertSession(db, room.id, { status: 'ongoing' });
    await insertSessionParticipant(db, session.id, user.id);

    await expect(service.getSession(session.id, user.id, false)).rejects.toMatchObject({
      response: { code: ERROR_CODES.SESSION_NOT_FOUND },
    });
  });

  it('GIVEN non-existent session WHEN getSession THEN throws NotFoundException', async () => {
    const user = await insertUser(db);

    await expect(
      service.getSession('00000000-0000-0000-0000-000000000000', user.id, false),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('deleteSession', () => {
  it('GIVEN participant WHEN deleteSession THEN inserts soft-delete row', async () => {
    const user = await insertUser(db);
    const room = await insertRoom(db, user.id);
    const session = await insertSession(db, room.id);
    await insertSessionParticipant(db, session.id, user.id);

    await service.deleteSession(session.id, user.id, false);

    const rows = await db
      .select()
      .from(sessionDeletions)
      .where(and(eq(sessionDeletions.sessionId, session.id), eq(sessionDeletions.userId, user.id)));
    expect(rows).toHaveLength(1);
  });

  it('GIVEN non-participant WHEN deleteSession THEN throws ForbiddenException', async () => {
    const { session } = await seedFinishedSession();
    const stranger = await insertUser(db);

    await expect(service.deleteSession(session.id, stranger.id, false)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('GIVEN already soft-deleted WHEN deleteSession again THEN is idempotent', async () => {
    const user = await insertUser(db);
    const room = await insertRoom(db, user.id);
    const session = await insertSession(db, room.id);
    await insertSessionParticipant(db, session.id, user.id);

    await service.deleteSession(session.id, user.id, false);
    await service.deleteSession(session.id, user.id, false);

    const rows = await db
      .select()
      .from(sessionDeletions)
      .where(and(eq(sessionDeletions.sessionId, session.id), eq(sessionDeletions.userId, user.id)));
    expect(rows).toHaveLength(1);
  });

  it('GIVEN admin WHEN deleteSession for non-participated session THEN succeeds', async () => {
    const admin = await insertUser(db, { role: 'admin' });
    const { session } = await seedFinishedSession();

    await service.deleteSession(session.id, admin.id, true);

    const rows = await db
      .select()
      .from(sessionDeletions)
      .where(
        and(eq(sessionDeletions.sessionId, session.id), eq(sessionDeletions.userId, admin.id)),
      );
    expect(rows).toHaveLength(1);
  });
});

describe('isAdmin', () => {
  it('GIVEN admin user WHEN isAdmin THEN returns true', async () => {
    const admin = await insertUser(db, { role: 'admin' });
    await expect(service.isAdmin(admin.id)).resolves.toBe(true);
  });

  it('GIVEN regular user WHEN isAdmin THEN returns false', async () => {
    const user = await insertUser(db);
    await expect(service.isAdmin(user.id)).resolves.toBe(false);
  });
});
