import { defineRoute } from '@syncode/contracts';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@syncode/ui';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { motion } from 'motion/react';
import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ProblemCard } from '@/components/problems/problem-card';
import type {
  ProblemDifficulty,
  ProblemItem,
  ProblemSortKey,
  ProblemStatus,
} from '@/components/problems/problems.mock';
import { ProblemsEmptyState } from '@/components/problems/problems-empty-state';
import { ProblemsFilterSidebar } from '@/components/problems/problems-filter-sidebar';
import {
  getMockProblemsListResponse,
  type ProblemSummary,
  type ProblemsApiDifficulty,
  type ProblemsListQuery,
  type ProblemsListResponse,
} from '@/components/problems/problems-list.mock';
import { ProblemsResultsToolbar } from '@/components/problems/problems-results-toolbar';
import { ProblemsSearchBar } from '@/components/problems/problems-search-bar';
import {
  getProblemTagName,
  MOCK_PROBLEM_TAGS_RESPONSE,
  type ProblemsTagsResponse,
} from '@/components/problems/problems-tags.mock';
import { api } from '@/lib/api-client';

export const Route = createFileRoute('/problems')({
  component: ProblemsPage,
});

const PROBLEMS_PAGE_SIZE = 12;
const useMockProblemTags = import.meta.env.VITE_PROBLEMS_FILTER_TAGS_USE_MOCK_SESSIONS === 'true';
const useMockProblemCards = import.meta.env.VITE_PROBLEMS_CARDS_USE_MOCK_SESSIONS === 'true';
const problemsListRoute = defineRoute<ProblemsListQuery, ProblemsListResponse>()('problems', 'GET');
const problemsTagsRoute = defineRoute<void, ProblemsTagsResponse>()('problems/tags', 'GET');
const apiDifficultyToUiDifficulty: Record<ProblemsApiDifficulty, ProblemDifficulty> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};
const uiDifficultyToApiDifficulty: Record<ProblemDifficulty, ProblemsApiDifficulty> = {
  Easy: 'easy',
  Medium: 'medium',
  Hard: 'hard',
};

function createInitialPaginationState() {
  return {
    currentCursor: undefined as string | undefined,
    cursorHistory: [] as Array<string | undefined>,
  };
}

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

function getBackendSortQuery(sort: ProblemSortKey) {
  if (sort === 'difficulty') {
    return {
      sortBy: 'difficulty' as const,
      sortOrder: 'asc' as const,
    };
  }

  if (sort === 'newest') {
    return {
      sortBy: 'createdAt' as const,
      sortOrder: 'desc' as const,
    };
  }

  return {};
}

async function fetchProblemTags() {
  if (useMockProblemTags) {
    return MOCK_PROBLEM_TAGS_RESPONSE;
  }

  return api(problemsTagsRoute);
}

async function fetchProblemsList(query: ProblemsListQuery) {
  if (useMockProblemCards) {
    return getMockProblemsListResponse(query);
  }

  return api(problemsListRoute, { query });
}

function toggleValue<T>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function ProblemsPage() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  if (pathname !== '/problems') {
    return <Outlet />;
  }

  return <ProblemsLibraryPage />;
}

function ProblemsLibraryPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulties, setSelectedDifficulties] = useState<ProblemDifficulty[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<ProblemStatus[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sort, setSort] = useState<ProblemSortKey>('newest');
  const [paginationState, setPaginationState] = useState(createInitialPaginationState);
  const previousTagSignatureRef = useRef('');
  const previousVisibleProblemIdsRef = useRef<Set<string>>(new Set());

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedSearchQuery = deferredSearchQuery.trim();
  const tagSignature = selectedTags.join('::');
  const backendSortQuery = useMemo(() => getBackendSortQuery(sort), [sort]);
  const pushedDifficulty = useMemo(() => {
    const [selectedDifficulty] = selectedDifficulties;

    return selectedDifficulties.length === 1 && selectedDifficulty
      ? uiDifficultyToApiDifficulty[selectedDifficulty]
      : undefined;
  }, [selectedDifficulties]);
  const problemsListQuery = useMemo<ProblemsListQuery>(
    () => ({
      cursor: paginationState.currentCursor,
      limit: PROBLEMS_PAGE_SIZE,
      difficulty: pushedDifficulty,
      tags: selectedTags.length > 0 ? selectedTags.join(',') : undefined,
      search: normalizedSearchQuery.length > 0 ? normalizedSearchQuery : undefined,
      sortBy: backendSortQuery.sortBy,
      sortOrder: backendSortQuery.sortOrder,
    }),
    [
      backendSortQuery.sortBy,
      backendSortQuery.sortOrder,
      normalizedSearchQuery,
      paginationState.currentCursor,
      pushedDifficulty,
      selectedTags,
    ],
  );
  const {
    data: problemsListResponse,
    isPending: isProblemsPending,
    isFetching: isProblemsFetching,
  } = useQuery({
    queryKey: ['problems', 'list', useMockProblemCards ? 'mock' : 'api', problemsListQuery],
    queryFn: () => fetchProblemsList(problemsListQuery),
    placeholderData: (previousData) => previousData,
  });
  const { data: problemTagsResponse } = useQuery({
    queryKey: ['problems', 'tags', useMockProblemTags ? 'mock' : 'api'],
    queryFn: fetchProblemTags,
  });
  const problems = useMemo(
    () => problemsListResponse?.data.map(normalizeProblemSummary) ?? [],
    [problemsListResponse],
  );
  const problemsCount = problemsListResponse?.data.length ?? 0;

  const popularTags = useMemo(() => {
    return [...(problemTagsResponse?.data ?? [])].sort(
      (left, right) => right.count - left.count || left.name.localeCompare(right.name),
    );
  }, [problemTagsResponse]);
  const problemTagNameBySlug = useMemo(
    () => new Map(popularTags.map((tag) => [tag.slug, tag.name])),
    [popularTags],
  );

  const difficultyCounts = useMemo(
    () =>
      problems.reduce(
        (counts, problem) => {
          counts[problem.difficulty] += 1;
          return counts;
        },
        { Easy: 0, Medium: 0, Hard: 0 } as Record<ProblemDifficulty, number>,
      ),
    [problems],
  );

  const statusCounts = useMemo(
    () =>
      problems.reduce(
        (counts, problem) => {
          counts[problem.status] += 1;
          return counts;
        },
        { Solved: 0, Attempted: 0, Todo: 0 } as Record<ProblemStatus, number>,
      ),
    [problems],
  );

  const filteredProblems = useMemo(() => {
    return problems.filter((problem) => {
      const matchesDifficulty =
        selectedDifficulties.length <= 1 || selectedDifficulties.includes(problem.difficulty);

      const matchesStatus =
        selectedStatuses.length === 0 || selectedStatuses.includes(problem.status);

      return matchesDifficulty && matchesStatus;
    });
  }, [problems, selectedDifficulties, selectedStatuses]);

  const visibleProblems = useMemo(() => {
    if (sort !== 'acceptance') {
      return filteredProblems;
    }

    return [...filteredProblems].sort((left, right) => {
      return right.acceptanceRate - left.acceptanceRate || right.addedAt - left.addedAt;
    });
  }, [filteredProblems, sort]);
  const didTagFiltersChange = previousTagSignatureRef.current !== tagSignature;
  const previousVisibleProblemIds = previousVisibleProblemIdsRef.current;

  useEffect(() => {
    previousTagSignatureRef.current = tagSignature;
    previousVisibleProblemIdsRef.current = new Set(visibleProblems.map((problem) => problem.id));
  }, [tagSignature, visibleProblems]);

  const resetCursorPagination = () => {
    setPaginationState(createInitialPaginationState());
  };

  const clearAll = () => {
    startTransition(() => {
      setSearchQuery('');
      setSelectedDifficulties([]);
      setSelectedStatuses([]);
      setSelectedTags([]);
      setSort('newest');
      resetCursorPagination();
    });
  };

  const activeFilters = [
    ...selectedDifficulties.map((difficulty) => ({
      id: `difficulty-${difficulty}`,
      label: difficulty,
      onRemove: () => {
        startTransition(() => {
          setSelectedDifficulties((current) => current.filter((item) => item !== difficulty));
          resetCursorPagination();
        });
      },
    })),
    ...selectedStatuses.map((status) => ({
      id: `status-${status}`,
      label: status === 'Todo' ? 'Todo / Not done' : status,
      onRemove: () => {
        startTransition(() => {
          setSelectedStatuses((current) => current.filter((item) => item !== status));
          resetCursorPagination();
        });
      },
    })),
    ...selectedTags.map((tag) => ({
      id: `tag-${tag}`,
      label: problemTagNameBySlug.get(tag) ?? getProblemTagName(tag),
      onRemove: () => {
        startTransition(() => {
          setSelectedTags((current) => current.filter((item) => item !== tag));
          resetCursorPagination();
        });
      },
    })),
  ];

  const hasAnyFiltersApplied =
    normalizedSearchQuery.length > 0 ||
    selectedDifficulties.length > 0 ||
    selectedStatuses.length > 0 ||
    selectedTags.length > 0;
  const hasPreviousPage = paginationState.cursorHistory.length > 0;
  const nextCursor = problemsListResponse?.pagination.nextCursor ?? null;
  const hasNextPage = problemsListResponse?.pagination.hasMore === true && nextCursor !== null;
  const hasSourceProblems = problems.length > 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:py-12">
      <section className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Problem Library
        </h1>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">
          {isProblemsPending && !problemsListResponse
            ? 'Loading problems...'
            : `${problemsCount} problems`}
        </p>
      </section>

      <div className="mt-8 space-y-6">
        <ProblemsSearchBar
          value={searchQuery}
          onChange={(value) => {
            startTransition(() => {
              setSearchQuery(value);
              resetCursorPagination();
            });
          }}
        />

        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
          <ProblemsFilterSidebar
            selectedDifficulties={selectedDifficulties}
            selectedStatuses={selectedStatuses}
            selectedTags={selectedTags}
            difficultyCounts={difficultyCounts}
            statusCounts={statusCounts}
            popularTags={popularTags}
            onToggleDifficulty={(value) => {
              startTransition(() => {
                setSelectedDifficulties((current) => toggleValue(current, value));
                resetCursorPagination();
              });
            }}
            onToggleStatus={(value) => {
              startTransition(() => {
                setSelectedStatuses((current) => toggleValue(current, value));
                resetCursorPagination();
              });
            }}
            onToggleTag={(value) => {
              startTransition(() => {
                setSelectedTags((current) => toggleValue(current, value));
                resetCursorPagination();
              });
            }}
            onClearAll={clearAll}
          />

          <div className="space-y-5">
            <ProblemsResultsToolbar
              activeFilters={activeFilters}
              sort={sort}
              onSortChange={(value) => {
                startTransition(() => {
                  setSort(value);
                  resetCursorPagination();
                });
              }}
              onClearAll={clearAll}
            />

            {!problemsListResponse ? null : (
              <>
                {visibleProblems.length === 0 ? (
                  <ProblemsEmptyState
                    variant={hasAnyFiltersApplied ? 'filtered' : 'library'}
                    onReset={clearAll}
                  />
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {visibleProblems.map((problem) => {
                      const shouldFloatIn =
                        didTagFiltersChange && !previousVisibleProblemIds.has(problem.id);

                      return (
                        <motion.button
                          key={problem.id}
                          type="button"
                          layout="position"
                          className="block h-full cursor-pointer rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                          aria-label={`Open problem details for ${problem.title}`}
                          onClick={() => {
                            navigate({
                              to: '/problems/$problemId',
                              params: { problemId: problem.id },
                            }).catch(() => {});
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              navigate({
                                to: '/problems/$problemId',
                                params: { problemId: problem.id },
                              }).catch(() => {});
                            }
                          }}
                          whileTap={{ scale: 0.995 }}
                          initial={
                            shouldFloatIn
                              ? { opacity: 0, y: 18, scale: 0.985, filter: 'blur(4px)' }
                              : false
                          }
                          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                          transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
                        >
                          <ProblemCard
                            problem={problem}
                            tagNames={problem.tags.map(
                              (tag) => problemTagNameBySlug.get(tag) ?? getProblemTagName(tag),
                            )}
                          />
                        </motion.button>
                      );
                    })}
                  </div>
                )}

                {hasSourceProblems ? (
                  <Pagination className="pt-2">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          disabled={!hasPreviousPage || isProblemsFetching}
                          onClick={() => {
                            if (!hasPreviousPage || isProblemsFetching) {
                              return;
                            }

                            setPaginationState((current) => {
                              const previousCursor =
                                current.cursorHistory[current.cursorHistory.length - 1];

                              return {
                                currentCursor: previousCursor,
                                cursorHistory: current.cursorHistory.slice(0, -1),
                              };
                            });
                          }}
                        />
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext
                          disabled={!hasNextPage || isProblemsFetching}
                          onClick={() => {
                            if (!hasNextPage || !nextCursor || isProblemsFetching) {
                              return;
                            }

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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
