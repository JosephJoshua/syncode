export type ProblemDifficulty = 'Easy' | 'Medium' | 'Hard';
export type ProblemStatus = 'Solved' | 'Attempted' | 'Todo';
export type ProblemSortKey = 'newest' | 'acceptance' | 'difficulty';

export interface ProblemTagInfo {
  slug: string;
  name: string;
  count: number;
}

interface ProblemTagCatalogItem extends Omit<ProblemTagInfo, 'count'> {}

export interface ProblemsTagsResponse {
  data: ProblemTagInfo[];
}

export interface ProblemItem {
  id: string;
  title: string;
  difficulty: ProblemDifficulty;
  status: ProblemStatus;
  acceptanceRate: number;
  tags: string[];
  addedAt: number;
}

export const DIFFICULTY_OPTIONS: ProblemDifficulty[] = ['Easy', 'Medium', 'Hard'];
export const STATUS_OPTIONS: ProblemStatus[] = ['Solved', 'Attempted', 'Todo'];

const PROBLEM_TAG_CATALOG: ProblemTagCatalogItem[] = [
  { slug: 'arrays', name: 'Arrays' },
  { slug: 'strings', name: 'Strings' },
  { slug: 'dp', name: 'DP' },
  { slug: 'graphs', name: 'Graphs' },
  { slug: 'trees', name: 'Trees' },
  { slug: 'hash-table', name: 'Hash Table' },
  { slug: 'sliding-window', name: 'Sliding Window' },
  { slug: 'linked-list', name: 'Linked List' },
  { slug: 'stack', name: 'Stack' },
  { slug: 'recursion', name: 'Recursion' },
  { slug: 'math', name: 'Math' },
  { slug: 'design', name: 'Design' },
  { slug: 'bfs', name: 'BFS' },
  { slug: 'binary-tree', name: 'Binary Tree' },
  { slug: 'topological-sort', name: 'Topological Sort' },
  { slug: 'dfs', name: 'DFS' },
  { slug: 'divide-and-conquer', name: 'Divide and Conquer' },
  { slug: 'heap', name: 'Heap' },
  { slug: 'two-pointers', name: 'Two Pointers' },
  { slug: 'sorting', name: 'Sorting' },
] as const;

const problemTagNameBySlug = new Map(PROBLEM_TAG_CATALOG.map((tag) => [tag.slug, tag.name]));

export const SORT_OPTIONS: Array<{ label: string; value: ProblemSortKey }> = [
  { label: 'Newest', value: 'newest' },
  { label: 'Acceptance rate', value: 'acceptance' },
  { label: 'Difficulty', value: 'difficulty' },
];

export const MOCK_PROBLEMS: ProblemItem[] = [
  {
    id: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    status: 'Solved',
    acceptanceRate: 67,
    tags: ['arrays', 'hash-table'],
    addedAt: 24,
  },
  {
    id: 'valid-parentheses',
    title: 'Valid Parentheses',
    difficulty: 'Easy',
    status: 'Solved',
    acceptanceRate: 72,
    tags: ['strings', 'stack'],
    addedAt: 23,
  },
  {
    id: 'merge-two-sorted-lists',
    title: 'Merge Two Sorted Lists',
    difficulty: 'Easy',
    status: 'Attempted',
    acceptanceRate: 74,
    tags: ['linked-list', 'recursion'],
    addedAt: 22,
  },
  {
    id: 'longest-substring-without-repeating-characters',
    title: 'Longest Substring Without Repeating Characters',
    difficulty: 'Medium',
    status: 'Attempted',
    acceptanceRate: 45,
    tags: ['strings', 'sliding-window', 'hash-table'],
    addedAt: 21,
  },
  {
    id: 'add-two-numbers',
    title: 'Add Two Numbers',
    difficulty: 'Medium',
    status: 'Todo',
    acceptanceRate: 52,
    tags: ['linked-list', 'math', 'recursion'],
    addedAt: 20,
  },
  {
    id: 'lru-cache',
    title: 'LRU Cache',
    difficulty: 'Medium',
    status: 'Todo',
    acceptanceRate: 41,
    tags: ['hash-table', 'design', 'linked-list'],
    addedAt: 19,
  },
  {
    id: 'binary-tree-level-order-traversal',
    title: 'Binary Tree Level Order Traversal',
    difficulty: 'Medium',
    status: 'Solved',
    acceptanceRate: 63,
    tags: ['trees', 'bfs', 'binary-tree'],
    addedAt: 18,
  },
  {
    id: 'course-schedule',
    title: 'Course Schedule',
    difficulty: 'Medium',
    status: 'Attempted',
    acceptanceRate: 48,
    tags: ['graphs', 'topological-sort', 'bfs', 'dfs'],
    addedAt: 17,
  },
  {
    id: 'merge-k-sorted-lists',
    title: 'Merge K Sorted Lists',
    difficulty: 'Hard',
    status: 'Todo',
    acceptanceRate: 34,
    tags: ['linked-list', 'divide-and-conquer', 'heap'],
    addedAt: 16,
  },
  {
    id: 'trapping-rain-water',
    title: 'Trapping Rain Water',
    difficulty: 'Hard',
    status: 'Attempted',
    acceptanceRate: 28,
    tags: ['arrays', 'two-pointers', 'dp', 'stack'],
    addedAt: 15,
  },
  {
    id: 'word-ladder',
    title: 'Word Ladder',
    difficulty: 'Hard',
    status: 'Todo',
    acceptanceRate: 31,
    tags: ['bfs', 'hash-table', 'strings'],
    addedAt: 14,
  },
  {
    id: 'serialize-and-deserialize-binary-tree',
    title: 'Serialize and Deserialize Binary Tree',
    difficulty: 'Hard',
    status: 'Todo',
    acceptanceRate: 36,
    tags: ['trees', 'design', 'bfs', 'dfs'],
    addedAt: 13,
  },
  {
    id: 'best-time-to-buy-and-sell-stock',
    title: 'Best Time to Buy and Sell Stock',
    difficulty: 'Easy',
    status: 'Solved',
    acceptanceRate: 54,
    tags: ['arrays', 'dp'],
    addedAt: 12,
  },
  {
    id: 'maximum-subarray',
    title: 'Maximum Subarray',
    difficulty: 'Medium',
    status: 'Solved',
    acceptanceRate: 50,
    tags: ['arrays', 'dp', 'divide-and-conquer'],
    addedAt: 11,
  },
  {
    id: 'container-with-most-water',
    title: 'Container With Most Water',
    difficulty: 'Medium',
    status: 'Attempted',
    acceptanceRate: 57,
    tags: ['arrays', 'two-pointers'],
    addedAt: 10,
  },
  {
    id: 'group-anagrams',
    title: 'Group Anagrams',
    difficulty: 'Medium',
    status: 'Solved',
    acceptanceRate: 59,
    tags: ['hash-table', 'strings', 'sorting'],
    addedAt: 9,
  },
  {
    id: 'climbing-stairs',
    title: 'Climbing Stairs',
    difficulty: 'Easy',
    status: 'Solved',
    acceptanceRate: 53,
    tags: ['dp', 'math'],
    addedAt: 8,
  },
  {
    id: 'coin-change',
    title: 'Coin Change',
    difficulty: 'Medium',
    status: 'Todo',
    acceptanceRate: 46,
    tags: ['dp', 'arrays'],
    addedAt: 7,
  },
  {
    id: 'number-of-islands',
    title: 'Number of Islands',
    difficulty: 'Medium',
    status: 'Attempted',
    acceptanceRate: 58,
    tags: ['graphs', 'dfs', 'bfs'],
    addedAt: 6,
  },
  {
    id: 'rotting-oranges',
    title: 'Rotting Oranges',
    difficulty: 'Medium',
    status: 'Todo',
    acceptanceRate: 49,
    tags: ['graphs', 'bfs', 'arrays'],
    addedAt: 5,
  },
  {
    id: 'same-tree',
    title: 'Same Tree',
    difficulty: 'Easy',
    status: 'Solved',
    acceptanceRate: 65,
    tags: ['trees', 'dfs', 'binary-tree'],
    addedAt: 4,
  },
  {
    id: 'diameter-of-binary-tree',
    title: 'Diameter of Binary Tree',
    difficulty: 'Easy',
    status: 'Attempted',
    acceptanceRate: 61,
    tags: ['trees', 'dfs', 'binary-tree'],
    addedAt: 3,
  },
  {
    id: 'edit-distance',
    title: 'Edit Distance',
    difficulty: 'Hard',
    status: 'Todo',
    acceptanceRate: 43,
    tags: ['dp', 'strings'],
    addedAt: 2,
  },
  {
    id: 'minimum-window-substring',
    title: 'Minimum Window Substring',
    difficulty: 'Hard',
    status: 'Attempted',
    acceptanceRate: 39,
    tags: ['strings', 'sliding-window', 'hash-table'],
    addedAt: 1,
  },
];

export const MOCK_PROBLEM_TAGS_RESPONSE: ProblemsTagsResponse = {
  data: PROBLEM_TAG_CATALOG.map((tag) => ({
    ...tag,
    count: MOCK_PROBLEMS.filter((problem) => problem.tags.includes(tag.slug)).length,
  }))
    .filter((tag) => tag.count > 0)
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name)),
};

export function getProblemTagName(slug: string) {
  return problemTagNameBySlug.get(slug) ?? slug;
}
