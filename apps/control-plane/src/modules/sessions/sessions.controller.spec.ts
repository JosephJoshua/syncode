import { describe, expect, it, vi } from 'vitest';
import { SessionReportsService } from './session-reports.service.js';
import { SessionsController } from './sessions.controller.js';
import type { SessionsService } from './sessions.service.js';

const AUTH_USER = { id: 'user-1', email: 'user@example.com' };

const SESSION_DETAIL_RESULT = {
  sessionId: 'session-1',
  roomId: 'room-1',
  mode: 'peer' as const,
  problem: { id: 'problem-1', title: 'Two Sum', difficulty: 'easy' as const },
  language: 'python' as const,
  duration: 3600,
  participants: [
    {
      userId: 'user-1',
      username: 'alice',
      displayName: 'Alice',
      role: 'candidate' as const,
      joinedAt: new Date('2026-04-01T00:00:00Z'),
      leftAt: null,
    },
  ],
  runs: [
    {
      jobId: 'job-1',
      status: 'completed' as const,
      createdAt: new Date('2026-04-01T00:30:00Z'),
    },
  ],
  submissions: [
    {
      submissionId: 'sub-1',
      status: 'completed' as const,
      passed: 5,
      total: 5,
      createdAt: new Date('2026-04-01T00:45:00Z'),
    },
  ],
  hasReport: true,
  hasFeedback: false,
  hasRecording: false,
  createdAt: new Date('2026-04-01T00:00:00Z'),
  finishedAt: new Date('2026-04-01T01:00:00Z'),
};

const LIST_RESULT = {
  data: [
    {
      sessionId: 'session-1',
      roomId: 'room-1',
      mode: 'peer' as const,
      problemTitle: 'Two Sum',
      difficulty: 'easy',
      language: 'python' as const,
      duration: 3600,
      durationMs: 3600000,
      participants: [
        {
          userId: 'user-1',
          username: 'alice',
          displayName: 'Alice',
          avatarUrl: null,
          role: 'candidate' as const,
        },
      ],
      overallScore: 85,
      hasReport: true,
      hasFeedback: false,
      createdAt: new Date('2026-04-01T00:00:00Z'),
      finishedAt: new Date('2026-04-01T01:00:00Z'),
    },
  ],
  pagination: { nextCursor: null, hasMore: false },
};

const SNAPSHOTS_RESULT = {
  data: [
    {
      snapshotId: 'snapshot-1',
      timestamp: new Date('2026-04-01T00:10:00Z'),
      trigger: 'phase_change' as const,
      language: 'python' as const,
      code: 'print("hello")',
      linesOfCode: 1,
    },
  ],
  pagination: { nextCursor: null, hasMore: false },
};

const REPORT_RESULT = {
  sessionId: 'session-1',
  generatedAt: '2026-04-01T01:00:00.000Z',
  overallScore: 85,
  dimensions: {
    correctness: {
      score: 90,
      feedback: 'Good correctness',
      evidence: [],
    },
  },
  strengths: ['Strong debugging'],
  areasForImprovement: ['Explain tradeoffs'],
  detailedFeedback: 'Detailed feedback',
  comparisonToHistory: null,
  peerFeedbackSummary: null,
  testCaseBreakdown: [],
};

function createFixture() {
  const sessionsService: Pick<
    SessionsService,
    'listSessions' | 'listSnapshots' | 'getSession' | 'deleteSession' | 'isAdmin'
  > = {
    isAdmin: vi.fn(async () => false),
    listSessions: vi.fn(async () => LIST_RESULT),
    listSnapshots: vi.fn(async () => SNAPSHOTS_RESULT),
    getSession: vi.fn(async () => SESSION_DETAIL_RESULT),
    deleteSession: vi.fn(async () => undefined),
  };
  const sessionReportsService: Pick<SessionReportsService, 'getReport'> = {
    getReport: vi.fn(async () => REPORT_RESULT),
  };

  const controller = new SessionsController(
    sessionsService as SessionsService,
    sessionReportsService as SessionReportsService,
  );
  return { controller, sessionsService, sessionReportsService };
}

describe('SessionsController', () => {
  describe('listSessions', () => {
    it('GIVEN session list WHEN listing THEN serializes dates to ISO strings and strips durationMs', async () => {
      const { controller } = createFixture();

      const result = await controller.listSessions(AUTH_USER, {
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.data[0].createdAt).toBe('2026-04-01T00:00:00.000Z');
      expect(result.data[0].finishedAt).toBe('2026-04-01T01:00:00.000Z');
      expect(result.data[0]).not.toHaveProperty('durationMs');
      expect(result.pagination).toEqual({ nextCursor: null, hasMore: false });
    });

    it('GIVEN session with null finishedAt WHEN listing THEN serializes to null', async () => {
      const { controller, sessionsService } = createFixture();
      (sessionsService.listSessions as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: [{ ...LIST_RESULT.data[0], finishedAt: null }],
        pagination: LIST_RESULT.pagination,
      });

      const result = await controller.listSessions(AUTH_USER, {
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.data[0].finishedAt).toBeNull();
    });
  });

  describe('getSession', () => {
    it('GIVEN session detail WHEN getting THEN serializes all nested dates to ISO strings', async () => {
      const { controller } = createFixture();

      const result = await controller.getSession(AUTH_USER, 'session-1');

      expect(result.createdAt).toBe('2026-04-01T00:00:00.000Z');
      expect(result.finishedAt).toBe('2026-04-01T01:00:00.000Z');
      expect(result.participants[0].joinedAt).toBe('2026-04-01T00:00:00.000Z');
      expect(result.participants[0].leftAt).toBeNull();
      expect(result.runs[0].createdAt).toBe('2026-04-01T00:30:00.000Z');
      expect(result.submissions[0].createdAt).toBe('2026-04-01T00:45:00.000Z');
    });
  });

  describe('listSnapshots', () => {
    it('GIVEN code snapshots WHEN listing THEN serializes timestamps and includes pagination', async () => {
      const { controller } = createFixture();

      const result = await controller.listSnapshots(AUTH_USER, 'session-1', {
        limit: 50,
        sortOrder: 'asc',
      });

      expect(result).toEqual({
        data: [
          {
            snapshotId: 'snapshot-1',
            timestamp: '2026-04-01T00:10:00.000Z',
            trigger: 'phase_change',
            language: 'python',
            code: 'print("hello")',
            linesOfCode: 1,
          },
        ],
        pagination: { nextCursor: null, hasMore: false },
      });
    });
  });

  describe('getReport', () => {
    it('GIVEN session report WHEN getting THEN returns the report body unchanged', async () => {
      const { controller } = createFixture();

      const result = await controller.getReport(AUTH_USER, 'session-1');

      expect(result).toEqual(REPORT_RESULT);
    });
  });
});
