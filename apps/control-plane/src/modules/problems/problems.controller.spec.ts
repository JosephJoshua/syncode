import { describe, expect, it, vi } from 'vitest';
import { ProblemsController } from './problems.controller.js';
import type { ProblemsService } from './problems.service.js';

const USER = { id: 'user-1', email: 'a@b.com', role: 'user' as const };

function createFixture() {
  const service: Pick<ProblemsService, 'listProblems' | 'findById' | 'listTags' | 'createProblem'> =
    {
      listProblems: vi.fn().mockResolvedValue({
        data: [],
        pagination: { nextCursor: null, hasMore: false },
      }),
      findById: vi.fn().mockResolvedValue({
        id: 'p1',
        title: 'Two Sum',
        difficulty: 'easy',
        isPublished: true,
        tags: [],
        company: null,
        acceptanceRate: null,
        isBookmarked: false,
        attemptStatus: null,
        description: 'desc',
        constraints: null,
        examples: [],
        testCases: [],
        starterCode: null,
        timeLimit: null,
        memoryLimit: null,
        totalSubmissions: 0,
        userAttempts: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
      listTags: vi.fn().mockResolvedValue({ data: [] }),
      createProblem: vi.fn().mockResolvedValue({
        id: 'p1',
        title: 'Two Sum',
        difficulty: 'easy',
        isPublished: false,
        tags: [],
        company: null,
        acceptanceRate: null,
        isBookmarked: false,
        attemptStatus: null,
        description: 'desc',
        constraints: null,
        examples: [],
        testCases: [],
        starterCode: null,
        timeLimit: null,
        memoryLimit: null,
        totalSubmissions: 0,
        userAttempts: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
    };
  const controller = new ProblemsController(service as ProblemsService);
  return { controller, service };
}

describe('ProblemsController', () => {
  describe('listProblems', () => {
    it('GIVEN valid query WHEN listing problems THEN delegates to service with userId', async () => {
      const { controller, service } = createFixture();
      const query = { limit: 20, sortOrder: 'desc' as const };
      await controller.listProblems(USER, query);
      expect(service.listProblems).toHaveBeenCalledWith(USER.id, query);
    });

    it('GIVEN service returns data WHEN listing THEN returns service result directly', async () => {
      const { controller } = createFixture();
      const result = await controller.listProblems(USER, { limit: 20, sortOrder: 'desc' });
      expect(result).toEqual({
        data: [],
        pagination: { nextCursor: null, hasMore: false },
      });
    });
  });

  describe('getProblem', () => {
    it('GIVEN valid ID WHEN getting problem THEN delegates to service with userId and id', async () => {
      const { controller, service } = createFixture();
      await controller.getProblem(USER, 'p1');
      expect(service.findById).toHaveBeenCalledWith(USER.id, 'p1', { includeHidden: undefined });
    });

    it('GIVEN includeHidden query WHEN getting problem THEN forwards editor option', async () => {
      const { controller, service } = createFixture();
      await controller.getProblem(USER, 'p1', { includeHidden: true });
      expect(service.findById).toHaveBeenCalledWith(USER.id, 'p1', { includeHidden: true });
    });
  });

  describe('listTags', () => {
    it('WHEN listing tags THEN delegates to service', async () => {
      const { controller, service } = createFixture();
      await controller.listTags();
      expect(service.listTags).toHaveBeenCalled();
    });

    it('GIVEN service returns tags WHEN listing THEN returns service result directly', async () => {
      const { controller, service } = createFixture();
      (service.listTags as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: [{ slug: 'arrays', name: 'Arrays', count: 5 }],
      });
      const result = await controller.listTags();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].slug).toBe('arrays');
    });
  });

  describe('createProblem', () => {
    it('GIVEN valid input WHEN creating problem THEN delegates to service with userId and body', async () => {
      const { controller, service } = createFixture();
      const body = {
        title: 'Two Sum',
        description: 'Find a pair.',
        difficulty: 'easy' as const,
        isPublished: false,
        company: null,
        constraints: null,
        examples: [],
        starterCode: null,
        timeLimit: null,
        memoryLimit: null,
        testCases: [{ input: '1 2', expectedOutput: '3', isHidden: false }],
      };

      await controller.createProblem(USER, body);

      expect(service.createProblem).toHaveBeenCalledWith(USER.id, body, undefined);
    });
  });
});
