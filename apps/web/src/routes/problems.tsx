import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@syncode/ui';
import { createFileRoute, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { motion } from 'motion/react';
import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ProblemCard } from '@/components/problems/problem-card';
import {
  MOCK_PROBLEMS,
  type ProblemDifficulty,
  type ProblemSortKey,
  type ProblemStatus,
} from '@/components/problems/problems.mock';
import { ProblemsEmptyState } from '@/components/problems/problems-empty-state';
import { ProblemsFilterSidebar } from '@/components/problems/problems-filter-sidebar';
import { ProblemsResultsToolbar } from '@/components/problems/problems-results-toolbar';
import { ProblemsSearchBar } from '@/components/problems/problems-search-bar';

export const Route = createFileRoute('/problems')({
  component: ProblemsPage,
});

const PAGE_SIZE = 12;
const difficultyRank: Record<ProblemDifficulty, number> = {
  Easy: 0,
  Medium: 1,
  Hard: 2,
};

function getPaginationItems(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis-end', totalPages] as const;
  }

  if (currentPage >= totalPages - 3) {
    return [
      1,
      'ellipsis-start',
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ] as const;
  }

  return [
    1,
    'ellipsis-start',
    currentPage - 1,
    currentPage,
    currentPage + 1,
    'ellipsis-end',
    totalPages,
  ] as const;
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
  const [page, setPage] = useState(1);
  const previousTagSignatureRef = useRef('');
  const previousVisibleProblemIdsRef = useRef<Set<string>>(new Set());

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const tagSignature = selectedTags.join('::');

  const difficultyCounts = useMemo(
    () =>
      MOCK_PROBLEMS.reduce(
        (counts, problem) => {
          counts[problem.difficulty] += 1;
          return counts;
        },
        { Easy: 0, Medium: 0, Hard: 0 } as Record<ProblemDifficulty, number>,
      ),
    [],
  );

  const statusCounts = useMemo(
    () =>
      MOCK_PROBLEMS.reduce(
        (counts, problem) => {
          counts[problem.status] += 1;
          return counts;
        },
        { Solved: 0, Attempted: 0, Todo: 0 } as Record<ProblemStatus, number>,
      ),
    [],
  );

  const tagCounts = useMemo(
    () =>
      MOCK_PROBLEMS.reduce(
        (counts, problem) => {
          for (const tag of problem.tags) {
            counts[tag] = (counts[tag] ?? 0) + 1;
          }

          return counts;
        },
        {} as Record<string, number>,
      ),
    [],
  );

  const filteredProblems = useMemo(() => {
    const normalizedQuery = deferredSearchQuery.trim().toLowerCase();

    return MOCK_PROBLEMS.filter((problem) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        problem.title.toLowerCase().includes(normalizedQuery) ||
        problem.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery));

      const matchesDifficulty =
        selectedDifficulties.length === 0 || selectedDifficulties.includes(problem.difficulty);

      const matchesStatus =
        selectedStatuses.length === 0 || selectedStatuses.includes(problem.status);

      const matchesTags =
        selectedTags.length === 0 || selectedTags.every((tag) => problem.tags.includes(tag));

      return matchesQuery && matchesDifficulty && matchesStatus && matchesTags;
    });
  }, [deferredSearchQuery, selectedDifficulties, selectedStatuses, selectedTags]);

  const sortedProblems = useMemo(() => {
    return [...filteredProblems].sort((left, right) => {
      if (sort === 'acceptance') {
        return right.acceptanceRate - left.acceptanceRate;
      }

      if (sort === 'difficulty') {
        return difficultyRank[left.difficulty] - difficultyRank[right.difficulty];
      }

      return right.addedAt - left.addedAt;
    });
  }, [filteredProblems, sort]);

  const totalPages = Math.max(1, Math.ceil(sortedProblems.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const paginatedProblems = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return sortedProblems.slice(startIndex, startIndex + PAGE_SIZE);
  }, [page, sortedProblems]);
  const didTagFiltersChange = previousTagSignatureRef.current !== tagSignature;
  const previousVisibleProblemIds = previousVisibleProblemIdsRef.current;

  useEffect(() => {
    previousTagSignatureRef.current = tagSignature;
    previousVisibleProblemIdsRef.current = new Set(paginatedProblems.map((problem) => problem.id));
  }, [tagSignature, paginatedProblems]);

  const clearAll = () => {
    startTransition(() => {
      setSearchQuery('');
      setSelectedDifficulties([]);
      setSelectedStatuses([]);
      setSelectedTags([]);
      setSort('newest');
      setPage(1);
    });
  };

  const activeFilters = useMemo(
    () => [
      ...selectedDifficulties.map((difficulty) => ({
        id: `difficulty-${difficulty}`,
        label: difficulty,
        onRemove: () =>
          setSelectedDifficulties((current) => current.filter((item) => item !== difficulty)),
      })),
      ...selectedStatuses.map((status) => ({
        id: `status-${status}`,
        label: status === 'Todo' ? 'Todo / Not done' : status,
        onRemove: () => setSelectedStatuses((current) => current.filter((item) => item !== status)),
      })),
      ...selectedTags.map((tag) => ({
        id: `tag-${tag}`,
        label: tag,
        onRemove: () => setSelectedTags((current) => current.filter((item) => item !== tag)),
      })),
    ],
    [selectedDifficulties, selectedStatuses, selectedTags],
  );

  const paginationItems = useMemo(() => getPaginationItems(page, totalPages), [page, totalPages]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:py-12">
      <section className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Problem Library
        </h1>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">128 problems</p>
      </section>

      <div className="mt-8 space-y-6">
        <ProblemsSearchBar
          value={searchQuery}
          onChange={(value) => {
            startTransition(() => {
              setSearchQuery(value);
              setPage(1);
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
            tagCounts={tagCounts}
            onToggleDifficulty={(value) => {
              startTransition(() => {
                setSelectedDifficulties((current) => toggleValue(current, value));
                setPage(1);
              });
            }}
            onToggleStatus={(value) => {
              startTransition(() => {
                setSelectedStatuses((current) => toggleValue(current, value));
                setPage(1);
              });
            }}
            onToggleTag={(value) => {
              startTransition(() => {
                setSelectedTags((current) => toggleValue(current, value));
                setPage(1);
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
                  setPage(1);
                });
              }}
              onClearAll={clearAll}
            />

            {sortedProblems.length === 0 ? (
              <ProblemsEmptyState
                variant={MOCK_PROBLEMS.length === 0 ? 'library' : 'filtered'}
                onReset={clearAll}
              />
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {paginatedProblems.map((problem) => {
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
                        <ProblemCard problem={problem} />
                      </motion.button>
                    );
                  })}
                </div>

                <Pagination className="pt-2">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        disabled={page === 1}
                        onClick={() => {
                          setPage((current) => Math.max(1, current - 1));
                        }}
                      />
                    </PaginationItem>
                    {paginationItems.map((item) => (
                      <PaginationItem key={String(item)}>
                        {typeof item === 'number' ? (
                          <PaginationLink
                            isActive={item === page}
                            onClick={() => {
                              setPage(item);
                            }}
                          >
                            {item}
                          </PaginationLink>
                        ) : (
                          <PaginationEllipsis />
                        )}
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        disabled={page === totalPages}
                        onClick={() => {
                          setPage((current) => Math.min(totalPages, current + 1));
                        }}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
