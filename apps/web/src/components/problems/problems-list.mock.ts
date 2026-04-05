export type ProblemsApiDifficulty = 'easy' | 'medium' | 'hard';
export type ProblemAttemptStatus = 'solved' | 'attempted' | null;
export type ProblemsListSortBy =
  | 'title'
  | 'difficulty'
  | 'createdAt'
  | 'popularity'
  | 'totalSubmissions';
export type ProblemsListSortOrder = 'asc' | 'desc';

export interface ProblemsListQuery {
  cursor?: string;
  limit?: number;
  difficulty?: ProblemsApiDifficulty;
  tags?: string;
  company?: string;
  search?: string;
  sortBy?: ProblemsListSortBy;
  sortOrder?: ProblemsListSortOrder;
}

export interface ProblemSummary {
  id: string;
  title: string;
  difficulty: ProblemsApiDifficulty;
  tags: string[];
  company: string | null;
  acceptanceRate: number | null;
  isBookmarked: boolean;
  attemptStatus: ProblemAttemptStatus;
  testCaseCount?: number;
  hiddenTestCaseCount?: number;
  totalSubmissions?: number;
  updatedAt?: string;
}

export interface ProblemsListResponse {
  data: ProblemSummary[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}

const difficultyRank: Record<ProblemsApiDifficulty, number> = {
  easy: 0,
  medium: 1,
  hard: 2,
};

export const MOCK_PROBLEM_SUMMARIES: ProblemSummary[] = [
  {
    id: 'two-sum',
    title: 'Two Sum',
    difficulty: 'easy',
    tags: ['arrays', 'hash-table'],
    company: 'amazon',
    acceptanceRate: 67,
    isBookmarked: true,
    attemptStatus: 'solved',
    testCaseCount: 61,
    hiddenTestCaseCount: 17,
    totalSubmissions: 15420,
    updatedAt: '2026-03-24T09:00:00.000Z',
  },
  {
    id: 'valid-parentheses',
    title: 'Valid Parentheses',
    difficulty: 'easy',
    tags: ['strings', 'stack'],
    company: 'meta',
    acceptanceRate: 72,
    isBookmarked: false,
    attemptStatus: 'solved',
    testCaseCount: 58,
    hiddenTestCaseCount: 14,
    totalSubmissions: 14820,
    updatedAt: '2026-03-23T09:00:00.000Z',
  },
  {
    id: 'merge-two-sorted-lists',
    title: 'Merge Two Sorted Lists',
    difficulty: 'easy',
    tags: ['linked-list', 'recursion'],
    company: 'google',
    acceptanceRate: 74,
    isBookmarked: false,
    attemptStatus: 'attempted',
    testCaseCount: 52,
    hiddenTestCaseCount: 12,
    totalSubmissions: 13940,
    updatedAt: '2026-03-22T09:00:00.000Z',
  },
  {
    id: 'longest-substring-without-repeating-characters',
    title: 'Longest Substring Without Repeating Characters',
    difficulty: 'medium',
    tags: ['strings', 'sliding-window', 'hash-table'],
    company: 'amazon',
    acceptanceRate: 45,
    isBookmarked: true,
    attemptStatus: 'attempted',
    testCaseCount: 73,
    hiddenTestCaseCount: 21,
    totalSubmissions: 16780,
    updatedAt: '2026-03-21T09:00:00.000Z',
  },
  {
    id: 'add-two-numbers',
    title: 'Add Two Numbers',
    difficulty: 'medium',
    tags: ['linked-list', 'math', 'recursion'],
    company: 'microsoft',
    acceptanceRate: 52,
    isBookmarked: false,
    attemptStatus: null,
    testCaseCount: 68,
    hiddenTestCaseCount: 18,
    totalSubmissions: 15210,
    updatedAt: '2026-03-20T09:00:00.000Z',
  },
  {
    id: 'lru-cache',
    title: 'LRU Cache',
    difficulty: 'medium',
    tags: ['hash-table', 'design', 'linked-list'],
    company: 'uber',
    acceptanceRate: 41,
    isBookmarked: true,
    attemptStatus: null,
    testCaseCount: 84,
    hiddenTestCaseCount: 22,
    totalSubmissions: 12690,
    updatedAt: '2026-03-19T09:00:00.000Z',
  },
  {
    id: 'binary-tree-level-order-traversal',
    title: 'Binary Tree Level Order Traversal',
    difficulty: 'medium',
    tags: ['trees', 'bfs', 'binary-tree'],
    company: 'amazon',
    acceptanceRate: 63,
    isBookmarked: false,
    attemptStatus: 'solved',
    testCaseCount: 65,
    hiddenTestCaseCount: 15,
    totalSubmissions: 11180,
    updatedAt: '2026-03-18T09:00:00.000Z',
  },
  {
    id: 'course-schedule',
    title: 'Course Schedule',
    difficulty: 'medium',
    tags: ['graphs', 'topological-sort', 'bfs', 'dfs'],
    company: 'google',
    acceptanceRate: 48,
    isBookmarked: false,
    attemptStatus: 'attempted',
    testCaseCount: 76,
    hiddenTestCaseCount: 24,
    totalSubmissions: 11870,
    updatedAt: '2026-03-17T09:00:00.000Z',
  },
  {
    id: 'merge-k-sorted-lists',
    title: 'Merge K Sorted Lists',
    difficulty: 'hard',
    tags: ['linked-list', 'divide-and-conquer', 'heap'],
    company: 'meta',
    acceptanceRate: 34,
    isBookmarked: false,
    attemptStatus: null,
    testCaseCount: 91,
    hiddenTestCaseCount: 29,
    totalSubmissions: 9320,
    updatedAt: '2026-03-16T09:00:00.000Z',
  },
  {
    id: 'trapping-rain-water',
    title: 'Trapping Rain Water',
    difficulty: 'hard',
    tags: ['arrays', 'two-pointers', 'dp', 'stack'],
    company: 'amazon',
    acceptanceRate: 28,
    isBookmarked: true,
    attemptStatus: 'attempted',
    testCaseCount: 88,
    hiddenTestCaseCount: 26,
    totalSubmissions: 8740,
    updatedAt: '2026-03-15T09:00:00.000Z',
  },
  {
    id: 'word-ladder',
    title: 'Word Ladder',
    difficulty: 'hard',
    tags: ['bfs', 'hash-table', 'strings'],
    company: 'google',
    acceptanceRate: 31,
    isBookmarked: false,
    attemptStatus: null,
    testCaseCount: 82,
    hiddenTestCaseCount: 25,
    totalSubmissions: 7910,
    updatedAt: '2026-03-14T09:00:00.000Z',
  },
  {
    id: 'serialize-and-deserialize-binary-tree',
    title: 'Serialize and Deserialize Binary Tree',
    difficulty: 'hard',
    tags: ['trees', 'design', 'bfs', 'dfs'],
    company: 'microsoft',
    acceptanceRate: 36,
    isBookmarked: true,
    attemptStatus: null,
    testCaseCount: 79,
    hiddenTestCaseCount: 23,
    totalSubmissions: 8460,
    updatedAt: '2026-03-13T09:00:00.000Z',
  },
  {
    id: 'best-time-to-buy-and-sell-stock',
    title: 'Best Time to Buy and Sell Stock',
    difficulty: 'easy',
    tags: ['arrays', 'dp'],
    company: 'apple',
    acceptanceRate: 54,
    isBookmarked: false,
    attemptStatus: 'solved',
    testCaseCount: 49,
    hiddenTestCaseCount: 11,
    totalSubmissions: 13280,
    updatedAt: '2026-03-12T09:00:00.000Z',
  },
  {
    id: 'maximum-subarray',
    title: 'Maximum Subarray',
    difficulty: 'medium',
    tags: ['arrays', 'dp', 'divide-and-conquer'],
    company: 'amazon',
    acceptanceRate: 50,
    isBookmarked: false,
    attemptStatus: 'solved',
    testCaseCount: 62,
    hiddenTestCaseCount: 16,
    totalSubmissions: 12440,
    updatedAt: '2026-03-11T09:00:00.000Z',
  },
  {
    id: 'container-with-most-water',
    title: 'Container With Most Water',
    difficulty: 'medium',
    tags: ['arrays', 'two-pointers'],
    company: 'meta',
    acceptanceRate: 57,
    isBookmarked: false,
    attemptStatus: 'attempted',
    testCaseCount: 67,
    hiddenTestCaseCount: 19,
    totalSubmissions: 12130,
    updatedAt: '2026-03-10T09:00:00.000Z',
  },
  {
    id: 'group-anagrams',
    title: 'Group Anagrams',
    difficulty: 'medium',
    tags: ['hash-table', 'strings', 'sorting'],
    company: 'google',
    acceptanceRate: 59,
    isBookmarked: true,
    attemptStatus: 'solved',
    testCaseCount: 64,
    hiddenTestCaseCount: 16,
    totalSubmissions: 11980,
    updatedAt: '2026-03-09T09:00:00.000Z',
  },
  {
    id: 'climbing-stairs',
    title: 'Climbing Stairs',
    difficulty: 'easy',
    tags: ['dp', 'math'],
    company: 'adobe',
    acceptanceRate: 53,
    isBookmarked: false,
    attemptStatus: 'solved',
    testCaseCount: 46,
    hiddenTestCaseCount: 10,
    totalSubmissions: 12940,
    updatedAt: '2026-03-08T09:00:00.000Z',
  },
  {
    id: 'coin-change',
    title: 'Coin Change',
    difficulty: 'medium',
    tags: ['dp', 'arrays'],
    company: 'uber',
    acceptanceRate: 46,
    isBookmarked: false,
    attemptStatus: null,
    testCaseCount: 71,
    hiddenTestCaseCount: 20,
    totalSubmissions: 10750,
    updatedAt: '2026-03-07T09:00:00.000Z',
  },
  {
    id: 'number-of-islands',
    title: 'Number of Islands',
    difficulty: 'medium',
    tags: ['graphs', 'dfs', 'bfs'],
    company: 'amazon',
    acceptanceRate: 58,
    isBookmarked: true,
    attemptStatus: 'attempted',
    testCaseCount: 74,
    hiddenTestCaseCount: 19,
    totalSubmissions: 11230,
    updatedAt: '2026-03-06T09:00:00.000Z',
  },
  {
    id: 'rotting-oranges',
    title: 'Rotting Oranges',
    difficulty: 'medium',
    tags: ['graphs', 'bfs', 'arrays'],
    company: 'meta',
    acceptanceRate: 49,
    isBookmarked: false,
    attemptStatus: null,
    testCaseCount: 59,
    hiddenTestCaseCount: 15,
    totalSubmissions: 9840,
    updatedAt: '2026-03-05T09:00:00.000Z',
  },
  {
    id: 'same-tree',
    title: 'Same Tree',
    difficulty: 'easy',
    tags: ['trees', 'dfs', 'binary-tree'],
    company: 'microsoft',
    acceptanceRate: 65,
    isBookmarked: false,
    attemptStatus: 'solved',
    testCaseCount: 47,
    hiddenTestCaseCount: 11,
    totalSubmissions: 10420,
    updatedAt: '2026-03-04T09:00:00.000Z',
  },
  {
    id: 'diameter-of-binary-tree',
    title: 'Diameter of Binary Tree',
    difficulty: 'easy',
    tags: ['trees', 'dfs', 'binary-tree'],
    company: 'google',
    acceptanceRate: 61,
    isBookmarked: false,
    attemptStatus: 'attempted',
    testCaseCount: 53,
    hiddenTestCaseCount: 12,
    totalSubmissions: 10150,
    updatedAt: '2026-03-03T09:00:00.000Z',
  },
  {
    id: 'edit-distance',
    title: 'Edit Distance',
    difficulty: 'hard',
    tags: ['dp', 'strings'],
    company: 'amazon',
    acceptanceRate: 43,
    isBookmarked: true,
    attemptStatus: null,
    testCaseCount: 83,
    hiddenTestCaseCount: 24,
    totalSubmissions: 7420,
    updatedAt: '2026-03-02T09:00:00.000Z',
  },
  {
    id: 'minimum-window-substring',
    title: 'Minimum Window Substring',
    difficulty: 'hard',
    tags: ['strings', 'sliding-window', 'hash-table'],
    company: 'meta',
    acceptanceRate: 39,
    isBookmarked: false,
    attemptStatus: 'attempted',
    testCaseCount: 86,
    hiddenTestCaseCount: 27,
    totalSubmissions: 7660,
    updatedAt: '2026-03-01T09:00:00.000Z',
  },
];

function sortProblemSummaries(
  problems: ProblemSummary[],
  sortBy?: ProblemsListSortBy,
  sortOrder: ProblemsListSortOrder = 'asc',
) {
  if (!sortBy) {
    return problems;
  }

  const direction = sortOrder === 'desc' ? -1 : 1;

  return [...problems].sort((left, right) => {
    if (sortBy === 'title') {
      return left.title.localeCompare(right.title) * direction;
    }

    if (sortBy === 'difficulty') {
      return (difficultyRank[left.difficulty] - difficultyRank[right.difficulty]) * direction;
    }

    if (sortBy === 'totalSubmissions' || sortBy === 'popularity') {
      return ((left.totalSubmissions ?? 0) - (right.totalSubmissions ?? 0)) * direction;
    }

    const leftDate = left.updatedAt ? Date.parse(left.updatedAt) || 0 : 0;
    const rightDate = right.updatedAt ? Date.parse(right.updatedAt) || 0 : 0;

    return (leftDate - rightDate) * direction;
  });
}

export function getMockProblemsListResponse(query: ProblemsListQuery = {}): ProblemsListResponse {
  const normalizedSearch = query.search?.trim().toLowerCase() ?? '';
  const requestedTags =
    query.tags
      ?.split(',')
      .map((tag) => tag.trim())
      .filter(Boolean) ?? [];

  let problems = [...MOCK_PROBLEM_SUMMARIES];

  if (normalizedSearch.length > 0) {
    problems = problems.filter((problem) => {
      const matchesTitle = problem.title.toLowerCase().includes(normalizedSearch);
      const matchesTags = problem.tags.some((tag) => tag.toLowerCase().includes(normalizedSearch));
      const matchesCompany = problem.company?.toLowerCase().includes(normalizedSearch) ?? false;

      return matchesTitle || matchesTags || matchesCompany;
    });
  }

  if (query.difficulty) {
    problems = problems.filter((problem) => problem.difficulty === query.difficulty);
  }

  if (requestedTags.length > 0) {
    problems = problems.filter((problem) =>
      requestedTags.every((tag) => problem.tags.includes(tag)),
    );
  }

  if (query.company) {
    problems = problems.filter((problem) => problem.company === query.company);
  }

  const sortedProblems = sortProblemSummaries(problems, query.sortBy, query.sortOrder);
  const offset = query.cursor ? Number.parseInt(query.cursor, 10) || 0 : 0;
  const limit = Math.min(Math.max(query.limit ?? sortedProblems.length, 1), 100);
  const data = sortedProblems.slice(offset, offset + limit);
  const nextOffset = offset + data.length;
  const hasMore = nextOffset < sortedProblems.length;

  return {
    data,
    pagination: {
      nextCursor: hasMore ? String(nextOffset) : null,
      hasMore,
    },
  };
}

export const MOCK_PROBLEMS_LIST_RESPONSE = getMockProblemsListResponse();
