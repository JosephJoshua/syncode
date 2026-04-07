import { CONTROL_API, type ListBookmarksResponse, type ProblemSummary } from '@syncode/contracts';
import {
  Button,
  Card,
  CardContent,
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@syncode/ui';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Bookmark } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ProblemCard } from '@/components/problems/problem-card';
import type { ProblemDifficulty, ProblemItem } from '@/components/problems/problems.types';
import { formatTagSlug } from '@/components/problems/problems-tags';
import { api } from '@/lib/api-client';
import { requireAuth } from '@/lib/auth';

export const Route = createFileRoute('/bookmarks')({
  beforeLoad: requireAuth,
  component: BookmarksPage,
});

const BOOKMARKS_PAGE_SIZE = 12;

const apiDifficultyToUiDifficulty: Record<'easy' | 'medium' | 'hard', ProblemDifficulty> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

function normalizeProblemSummary(problem: ProblemSummary): ProblemItem {
  return {
    id: problem.id,
    title: problem.title,
    difficulty: apiDifficultyToUiDifficulty[problem.difficulty],
    status:
      problem.attemptStatus === 'solved'
        ? 'Solved'
        : problem.attemptStatus === 'attempted'
          ? 'Attempted'
          : 'Todo',
    acceptanceRate: problem.acceptanceRate ?? 0,
    tags: problem.tags,
    addedAt: problem.updatedAt ? Date.parse(problem.updatedAt) || 0 : 0,
  };
}

function createInitialPaginationState() {
  return {
    currentCursor: undefined as string | undefined,
    cursorHistory: [] as Array<string | undefined>,
  };
}

async function fetchBookmarks(
  query: Record<string, string | number | undefined>,
): Promise<ListBookmarksResponse> {
  return api(CONTROL_API.BOOKMARKS.LIST, { searchParams: query });
}

function BookmarksPage() {
  const navigate = useNavigate();
  const [paginationState, setPaginationState] = useState(createInitialPaginationState);

  const bookmarksQuery = useMemo<Record<string, string | number | undefined>>(
    () => ({
      cursor: paginationState.currentCursor,
      limit: BOOKMARKS_PAGE_SIZE,
    }),
    [paginationState.currentCursor],
  );

  const {
    data: bookmarksResponse,
    isPending,
    isFetching,
  } = useQuery({
    queryKey: ['bookmarks', 'list', bookmarksQuery],
    queryFn: () => fetchBookmarks(bookmarksQuery),
    placeholderData: (previousData) => previousData,
  });

  const problems = useMemo(
    () => bookmarksResponse?.data.map(normalizeProblemSummary) ?? [],
    [bookmarksResponse],
  );

  const hasPreviousPage = paginationState.cursorHistory.length > 0;
  const nextCursor = bookmarksResponse?.pagination.nextCursor ?? null;
  const hasNextPage = bookmarksResponse?.pagination.hasMore === true && nextCursor !== null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:py-12">
      <section className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Bookmarks</h1>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">
          {isPending && !bookmarksResponse
            ? 'Loading bookmarks...'
            : `${bookmarksResponse?.data.length ?? 0} bookmarked problems`}
        </p>
      </section>

      <div className="mt-8">
        {bookmarksResponse ? (
          <>
            {problems.length === 0 ? (
              <Card className="border-dashed border-border/70 bg-card/30 py-0 backdrop-blur-sm">
                <CardContent className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center">
                  <div className="mb-4 inline-flex size-12 items-center justify-center rounded-full border border-border/70 bg-background/70 text-primary">
                    <Bookmark className="size-5" />
                  </div>
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    No bookmarks yet
                  </h2>
                  <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                    Bookmark problems from the problem library to save them here for quick access.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-6"
                    onClick={() => {
                      navigate({ to: '/problems' }).catch(() => {});
                    }}
                  >
                    Browse problems
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {problems.map((problem) => (
                  <button
                    key={problem.id}
                    type="button"
                    className="block h-full cursor-pointer rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    aria-label={`Open problem details for ${problem.title}`}
                    onClick={() => {
                      navigate({
                        to: '/problems/$problemId',
                        params: { problemId: problem.id },
                      }).catch(() => {});
                    }}
                  >
                    <ProblemCard
                      problem={problem}
                      tagNames={problem.tags.map((tag) => formatTagSlug(tag))}
                    />
                  </button>
                ))}
              </div>
            )}

            {problems.length > 0 ? (
              <Pagination className="pt-6">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      disabled={!hasPreviousPage || isFetching}
                      onClick={() => {
                        if (!hasPreviousPage || isFetching) return;
                        setPaginationState((current) => ({
                          currentCursor: current.cursorHistory[current.cursorHistory.length - 1],
                          cursorHistory: current.cursorHistory.slice(0, -1),
                        }));
                      }}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      disabled={!hasNextPage || isFetching}
                      onClick={() => {
                        if (!hasNextPage || !nextCursor || isFetching) return;
                        setPaginationState((current) => ({
                          currentCursor: nextCursor,
                          cursorHistory: [...current.cursorHistory, current.currentCursor],
                        }));
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
