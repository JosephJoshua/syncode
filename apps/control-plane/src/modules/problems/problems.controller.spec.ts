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
    it('GIVEN service resolves problem WHEN getting THEN returns the problem detail', async () => {
      const { controller } = createFixture();
      const result = await controller.getProblem(USER, 'p1');
      expect(result.id).toBe('p1');
      expect(result.title).toBe('Two Sum');
    });

    it('GIVEN includeHidden query WHEN getting problem as non-admin THEN service rejects', async () => {
      const { controller, service } = createFixture();
      (service.findById as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Admin access required'),
      );
      await expect(controller.getProblem(USER, 'p1', { includeHidden: true })).rejects.toThrow(
        'Admin access required',
      );
    });
  });

  describe('listTags', () => {
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
    it('GIVEN service resolves WHEN creating problem THEN returns the created detail', async () => {
      const { controller } = createFixture();
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

      const result = await controller.createProblem(USER, body);

      expect(result.id).toBe('p1');
      expect(result.title).toBe('Two Sum');
      expect(result.isPublished).toBe(false);
    });
  });
});
