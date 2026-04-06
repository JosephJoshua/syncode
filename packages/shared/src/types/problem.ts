export const PROBLEM_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type ProblemDifficulty = (typeof PROBLEM_DIFFICULTIES)[number];

export const PROBLEM_ATTEMPT_STATUSES = ['solved', 'attempted'] as const;
export type ProblemAttemptStatus = (typeof PROBLEM_ATTEMPT_STATUSES)[number];

export const PROBLEMS_SORT_BY_OPTIONS = [
  'title',
  'difficulty',
  'createdAt',
  'popularity',
  'totalSubmissions',
] as const;
export type ProblemSortBy = (typeof PROBLEMS_SORT_BY_OPTIONS)[number];
