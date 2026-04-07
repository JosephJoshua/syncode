import { describe, expect, it, vi } from 'vitest';
import { SessionsController } from './sessions.controller';
import type { SessionsService } from './sessions.service';

const AUTH_USER = { id: 'user-1', email: 'user@example.com' };

const SESSION_DETAIL_RESULT = {
  sessionId: 'session-1',
  roomId: 'room-1',
  mode: 'peer' as const,
  problem: { id: 'problem-1', title: 'Two Sum', difficulty: 'easy' },
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

function createFixture() {
  const sessionsService: Pick<
    SessionsService,
    'listSessions' | 'getSession' | 'deleteSession' | 'isAdmin'
  > = {
    isAdmin: vi.fn(async () => false),
    listSessions: vi.fn(async () => LIST_RESULT),
    getSession: vi.fn(async () => SESSION_DETAIL_RESULT),
    deleteSession: vi.fn(async () => undefined),
  };

  const controller = new SessionsController(sessionsService as SessionsService);
  return { controller, sessionsService };
}

describe('SessionsController', () => {
  describe('listSessions', () => {
    it('GIVEN authenticated user WHEN listSessions THEN delegates to service with correct args and serializes dates', async () => {
      const { controller, sessionsService } = createFixture();
      const query = { limit: 20, sortBy: 'createdAt' as const, sortOrder: 'desc' as const };

      const result = await controller.listSessions(AUTH_USER, query);

      expect(sessionsService.isAdmin).toHaveBeenCalledWith('user-1');
      expect(sessionsService.listSessions).toHaveBeenCalledWith('user-1', query, false);
      expect(result.data[0].createdAt).toBe('2026-04-01T00:00:00.000Z');
      expect(result.data[0].finishedAt).toBe('2026-04-01T01:00:00.000Z');
      expect(result.data[0]).not.toHaveProperty('durationMs');
      expect(result.pagination).toEqual({ nextCursor: null, hasMore: false });
    });

    it('GIVEN session with null finishedAt WHEN listSessions THEN serializes to null', async () => {
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
    it('GIVEN authenticated user WHEN getSession THEN delegates to service and serializes all dates', async () => {
      const { controller, sessionsService } = createFixture();

      const result = await controller.getSession(AUTH_USER, 'session-1');

      expect(sessionsService.isAdmin).toHaveBeenCalledWith('user-1');
      expect(sessionsService.getSession).toHaveBeenCalledWith('session-1', 'user-1', false);
      expect(result.createdAt).toBe('2026-04-01T00:00:00.000Z');
      expect(result.finishedAt).toBe('2026-04-01T01:00:00.000Z');
      expect(result.participants[0].joinedAt).toBe('2026-04-01T00:00:00.000Z');
      expect(result.participants[0].leftAt).toBeNull();
      expect(result.runs[0].createdAt).toBe('2026-04-01T00:30:00.000Z');
      expect(result.submissions[0].createdAt).toBe('2026-04-01T00:45:00.000Z');
    });
  });

  describe('deleteSession', () => {
    it('GIVEN authenticated user WHEN deleteSession THEN delegates to service with isAdmin', async () => {
      const { controller, sessionsService } = createFixture();

      await controller.deleteSession(AUTH_USER, 'session-1');

      expect(sessionsService.isAdmin).toHaveBeenCalledWith('user-1');
      expect(sessionsService.deleteSession).toHaveBeenCalledWith('session-1', 'user-1', false);
    });

    it('GIVEN admin user WHEN deleteSession THEN passes isAdmin=true', async () => {
      const { controller, sessionsService } = createFixture();
      (sessionsService.isAdmin as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);

      await controller.deleteSession(AUTH_USER, 'session-1');

      expect(sessionsService.deleteSession).toHaveBeenCalledWith('session-1', 'user-1', true);
    });
  });
});
