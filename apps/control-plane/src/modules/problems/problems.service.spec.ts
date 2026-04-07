import { NotFoundException } from '@nestjs/common';
import type { Database } from '@syncode/db';
import { describe, expect, it, vi } from 'vitest';
import { ProblemsService } from './problems.service.js';

const USER_ID = '00000000-0000-0000-0000-000000000099';

/**
 * NOTE: listProblems, findById, listTags, and listBookmarks use complex Drizzle
 * joins + correlated subqueries that are impractical to mock at the unit level.
 * Cover with integration tests.
 */
function createMockDb(rows: unknown[] = []) {
  const thenableResult = Object.assign(Promise.resolve(rows), {
    orderBy: vi.fn().mockReturnValue(
      Object.assign(Promise.resolve([]), {
        limit: vi.fn().mockReturnValue(Promise.resolve([])),
      }),
    ),
    limit: vi.fn().mockReturnValue(Promise.resolve([])),
  });

  const mockWhere = vi.fn().mockReturnValue(thenableResult);
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

  const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
  const insertValues = vi.fn(() => ({ onConflictDoNothing }));
  const insert = vi.fn(() => ({ values: insertValues }));

  const deleteWhere = vi.fn().mockResolvedValue(undefined);
  const deleteFn = vi.fn(() => ({ where: deleteWhere }));

  return { select: mockSelect, insert, delete: deleteFn };
}

describe('ProblemsService', () => {
  describe('addBookmark', () => {
    it('GIVEN existing problem WHEN addBookmark THEN resolves without error', async () => {
      const db = createMockDb([{ id: 'problem-1' }]);
      const service = new ProblemsService(db as unknown as Database);

      await expect(service.addBookmark('user-1', 'problem-1')).resolves.toBeUndefined();
    });

    it('GIVEN non-existent problem WHEN addBookmark THEN throws NotFoundException', async () => {
      const db = createMockDb([]);
      const service = new ProblemsService(db as unknown as Database);

      await expect(service.addBookmark('user-1', 'nonexistent')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('removeBookmark', () => {
    it('GIVEN any problemId WHEN removeBookmark THEN resolves without error', async () => {
      const db = createMockDb();
      const service = new ProblemsService(db as unknown as Database);

      await expect(service.removeBookmark('user-1', 'problem-1')).resolves.toBeUndefined();
    });
  });

  describe('findById', () => {
    it('GIVEN non-existent problem WHEN finding THEN throws NotFoundException with PROBLEM_NOT_FOUND', async () => {
      const db = createMockDb([]);
      const service = new ProblemsService(db as unknown as Database);

      const error = await service.findById(USER_ID, 'missing').catch((e) => e);

      expect(error).toBeInstanceOf(NotFoundException);
      expect(error.response).toMatchObject({
        message: 'Problem not found',
        code: 'PROBLEM_NOT_FOUND',
      });
    });

    it('GIVEN existing problem WHEN finding THEN transforms DB row to contract shape', async () => {
      const now = new Date('2026-01-15T10:00:00.000Z');
      const row = {
        id: '00000000-0000-0000-0000-000000000001',
        title: 'Two Sum',
        description: 'Find pairs',
        difficulty: 'easy',
        company: 'google',
        constraints: '2 <= n',
        examples: [{ input: '[2,7]', output: '[0,1]' }],
        starterCode: { python: 'def solve():' },
        totalSubmissions: 200,
        tagsAgg: 'arrays,hash-map',
        acceptanceRate: '75.00',
        isBookmarked: true,
        attemptStatus: 'solved',
        userAttempts: '3',
        createdAt: now,
        updatedAt: now,
      };

      const db = createMockDb([row]);
      const service = new ProblemsService(db as unknown as Database);
      const result = await service.findById(USER_ID, row.id);

      // Tags split from comma-separated aggregate
      expect(result.tags).toEqual(['arrays', 'hash-map']);
      // JSONB fields preserved as-is
      expect(result.examples).toEqual([{ input: '[2,7]', output: '[0,1]' }]);
      expect(result.starterCode).toEqual({ python: 'def solve():' });
      // Dates converted to ISO strings
      expect(result.createdAt).toBe('2026-01-15T10:00:00.000Z');
      expect(result.updatedAt).toBe('2026-01-15T10:00:00.000Z');
      // Numeric string coerced to number
      expect(result.acceptanceRate).toBe(75);
      expect(result.userAttempts).toBe(3);
      // Boolean coercion
      expect(result.isBookmarked).toBe(true);
    });

    it('GIVEN problem with null JSONB fields WHEN finding THEN returns defaults', async () => {
      const now = new Date();
      const row = {
        id: '00000000-0000-0000-0000-000000000002',
        title: 'Empty',
        description: 'desc',
        difficulty: 'easy',
        company: null,
        constraints: null,
        examples: null,
        starterCode: null,
        totalSubmissions: 0,
        tagsAgg: null,
        acceptanceRate: null,
        isBookmarked: false,
        attemptStatus: null,
        userAttempts: '0',
        createdAt: now,
        updatedAt: now,
      };

      const db = createMockDb([row]);
      const service = new ProblemsService(db as unknown as Database);
      const result = await service.findById(USER_ID, row.id);

      expect(result.company).toBeNull();
      expect(result.constraints).toBeNull();
      expect(result.examples).toEqual([]);
      expect(result.starterCode).toBeNull();
      expect(result.tags).toEqual([]);
      expect(result.acceptanceRate).toBeNull();
      expect(result.attemptStatus).toBeNull();
    });
  });
});
