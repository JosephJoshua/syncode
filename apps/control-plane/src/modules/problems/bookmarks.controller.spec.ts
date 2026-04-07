import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@/modules/auth/auth.types.js';
import { BookmarksController } from './bookmarks.controller.js';
import type { ProblemsService } from './problems.service.js';

describe('BookmarksController', () => {
  const user: AuthUser = { id: 'user-1', email: 'user@example.com' };

  function createFixture() {
    const problemsService: Pick<
      ProblemsService,
      'addBookmark' | 'listBookmarks' | 'removeBookmark'
    > = {
      addBookmark: vi.fn(async () => undefined),
      removeBookmark: vi.fn(async () => undefined),
      listBookmarks: vi.fn(async () => ({
        data: [
          {
            id: 'p1',
            title: 'Two Sum',
            difficulty: 'easy' as const,
            tags: ['array'],
            company: null,
            acceptanceRate: 75,
            isBookmarked: true as const,
            attemptStatus: null,
          },
        ],
        pagination: { nextCursor: null, hasMore: false },
      })),
    };

    const controller = new BookmarksController(problemsService as ProblemsService);
    return { controller, problemsService };
  }

  it('GIVEN authenticated user WHEN listBookmarks THEN delegates to service with user id and query', async () => {
    const { controller, problemsService } = createFixture();
    const query = { limit: 10 };

    const result = await controller.listBookmarks(user, query);

    expect(problemsService.listBookmarks).toHaveBeenCalledWith('user-1', query);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.id).toBe('p1');
  });

  it('GIVEN authenticated user WHEN addBookmark THEN delegates to service with user id and problemId', async () => {
    const { controller, problemsService } = createFixture();

    await controller.addBookmark(user, 'problem-1');

    expect(problemsService.addBookmark).toHaveBeenCalledWith('user-1', 'problem-1');
  });

  it('GIVEN service throws NotFoundException WHEN addBookmark THEN propagates the error', async () => {
    const { controller, problemsService } = createFixture();
    (problemsService.addBookmark as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new NotFoundException('Problem not found'),
    );

    await expect(controller.addBookmark(user, 'nonexistent')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('GIVEN authenticated user WHEN removeBookmark THEN delegates to service with user id and problemId', async () => {
    const { controller, problemsService } = createFixture();

    await controller.removeBookmark(user, 'problem-1');

    expect(problemsService.removeBookmark).toHaveBeenCalledWith('user-1', 'problem-1');
  });
});
