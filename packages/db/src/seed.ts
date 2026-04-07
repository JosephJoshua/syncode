/**
 * ONLY FOR DEMO PURPOSES — DO NOT USE AS A PRODUCTION SEED
 */

import { createHash } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const client = postgres(databaseUrl, { max: 1 });
const db = drizzle(client, { schema });

// Simple hash for demo passwords — NOT for production use.
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
const demoPassword = hashPassword('password123');

const usersData = [
  {
    email: 'alice@example.com',
    username: 'alice',
    passwordHash: demoPassword,
    displayName: 'Alice Chen',
    role: 'admin' as const,
    bio: 'Platform admin and interview coach.',
  },
  {
    email: 'bob@example.com',
    username: 'bob',
    passwordHash: demoPassword,
    displayName: 'Bob Zhang',
    role: 'user' as const,
    bio: 'CS senior preparing for SWE interviews.',
  },
  {
    email: 'carol@example.com',
    username: 'carol',
    passwordHash: demoPassword,
    displayName: 'Carol Li',
    role: 'user' as const,
    bio: 'Graduate student focused on algorithms.',
  },
  {
    email: 'dave@example.com',
    username: 'dave',
    passwordHash: demoPassword,
    displayName: 'Dave Wang',
    role: 'user' as const,
    bio: 'Freshman learning data structures.',
  },
];

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------
const tagsData = [
  { name: 'Array', slug: 'array' },
  { name: 'String', slug: 'string' },
  { name: 'Hash Table', slug: 'hash-table' },
  { name: 'Linked List', slug: 'linked-list' },
  { name: 'Stack', slug: 'stack' },
  { name: 'Queue', slug: 'queue' },
  { name: 'Tree', slug: 'tree' },
  { name: 'Binary Search', slug: 'binary-search' },
  { name: 'Dynamic Programming', slug: 'dynamic-programming' },
  { name: 'Graph', slug: 'graph' },
  { name: 'Sorting', slug: 'sorting' },
  { name: 'Greedy', slug: 'greedy' },
  { name: 'Two Pointers', slug: 'two-pointers' },
  { name: 'Sliding Window', slug: 'sliding-window' },
  { name: 'Recursion', slug: 'recursion' },
  { name: 'Math', slug: 'math' },
];

// ---------------------------------------------------------------------------
// Problems — classic interview questions with test cases & starter code
// ---------------------------------------------------------------------------
interface ProblemSeed {
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  company: string | null;
  constraints: string | null;
  examples: { input: string; output: string; explanation?: string }[];
  starterCode: Record<string, string>;
  timeLimit: number;
  memoryLimit: number;
  tags: string[]; // tag slugs
  testCases: {
    input: string;
    expectedOutput: string;
    description?: string;
    isHidden: boolean;
    sortOrder: number;
  }[];
}

const problemsData: ProblemSeed[] = [
  // ---- Easy ---------------------------------------------------------------
  {
    title: 'Two Sum',
    description:
      'Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have **exactly one solution**, and you may not use the same element twice.\n\nYou can return the answer in any order.',
    difficulty: 'easy',
    company: 'Google',
    constraints:
      '2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9\nOnly one valid answer exists.',
    examples: [
      {
        input: 'nums = [2,7,11,15], target = 9',
        output: '[0,1]',
        explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].',
      },
      { input: 'nums = [3,2,4], target = 6', output: '[1,2]' },
      { input: 'nums = [3,3], target = 6', output: '[0,1]' },
    ],
    starterCode: {
      python:
        'class Solution:\n    def twoSum(self, nums: list[int], target: int) -> list[int]:\n        pass\n',
      javascript:
        '/**\n * @param {number[]} nums\n * @param {number} target\n * @return {number[]}\n */\nfunction twoSum(nums, target) {\n\n}\n',
      typescript: 'function twoSum(nums: number[], target: number): number[] {\n\n}\n',
      java: 'class Solution {\n    public int[] twoSum(int[] nums, int target) {\n\n    }\n}\n',
    },
    timeLimit: 5000,
    memoryLimit: 256,
    tags: ['array', 'hash-table'],
    testCases: [
      {
        input: '[2,7,11,15]\n9',
        expectedOutput: '[0,1]',
        description: 'Basic case',
        isHidden: false,
        sortOrder: 0,
      },
      {
        input: '[3,2,4]\n6',
        expectedOutput: '[1,2]',
        description: 'Non-adjacent elements',
        isHidden: false,
        sortOrder: 1,
      },
      {
        input: '[3,3]\n6',
        expectedOutput: '[0,1]',
        description: 'Duplicate values',
        isHidden: false,
        sortOrder: 2,
      },
      {
        input: '[1,5,3,7,2]\n9',
        expectedOutput: '[1,3]',
        description: 'Larger array',
        isHidden: true,
        sortOrder: 3,
      },
      {
        input: '[-1,-2,-3,-4,-5]\n-8',
        expectedOutput: '[2,4]',
        description: 'Negative numbers',
        isHidden: true,
        sortOrder: 4,
      },
    ],
  },
  {
    title: 'Valid Parentheses',
    description:
      "Given a string `s` containing just the characters `'('`, `')'`, `'{'`, `'}'`, `'['` and `']'`, determine if the input string is valid.\n\nAn input string is valid if:\n1. Open brackets must be closed by the same type of brackets.\n2. Open brackets must be closed in the correct order.\n3. Every close bracket has a corresponding open bracket of the same type.",
    difficulty: 'easy',
    company: 'Amazon',
    constraints: '1 <= s.length <= 10^4\ns consists of parentheses only.',
    examples: [
      { input: 's = "()"', output: 'true' },
      { input: 's = "()[]{}"', output: 'true' },
      { input: 's = "(]"', output: 'false' },
    ],
    starterCode: {
      python: 'class Solution:\n    def isValid(self, s: str) -> bool:\n        pass\n',
      javascript:
        '/**\n * @param {string} s\n * @return {boolean}\n */\nfunction isValid(s) {\n\n}\n',
      typescript: 'function isValid(s: string): boolean {\n\n}\n',
      java: 'class Solution {\n    public boolean isValid(String s) {\n\n    }\n}\n',
    },
    timeLimit: 5000,
    memoryLimit: 256,
    tags: ['string', 'stack'],
    testCases: [
      {
        input: '()',
        expectedOutput: 'true',
        description: 'Simple pair',
        isHidden: false,
        sortOrder: 0,
      },
      {
        input: '()[]{}',
        expectedOutput: 'true',
        description: 'Multiple types',
        isHidden: false,
        sortOrder: 1,
      },
      {
        input: '(]',
        expectedOutput: 'false',
        description: 'Mismatched',
        isHidden: false,
        sortOrder: 2,
      },
      {
        input: '([)]',
        expectedOutput: 'false',
        description: 'Wrong nesting order',
        isHidden: true,
        sortOrder: 3,
      },
      {
        input: '{[]}',
        expectedOutput: 'true',
        description: 'Nested valid',
        isHidden: true,
        sortOrder: 4,
      },
      {
        input: '',
        expectedOutput: 'true',
        description: 'Empty string',
        isHidden: true,
        sortOrder: 5,
      },
    ],
  },
  {
    title: 'Reverse Linked List',
    description:
      'Given the `head` of a singly linked list, reverse the list, and return the reversed list.',
    difficulty: 'easy',
    company: 'Microsoft',
    constraints:
      'The number of nodes in the list is the range [0, 5000].\n-5000 <= Node.val <= 5000',
    examples: [
      { input: 'head = [1,2,3,4,5]', output: '[5,4,3,2,1]' },
      { input: 'head = [1,2]', output: '[2,1]' },
      { input: 'head = []', output: '[]' },
    ],
    starterCode: {
      python:
        '# class ListNode:\n#     def __init__(self, val=0, next=None):\n#         self.val = val\n#         self.next = next\n\nclass Solution:\n    def reverseList(self, head: ListNode | None) -> ListNode | None:\n        pass\n',
      javascript:
        '/**\n * @param {ListNode} head\n * @return {ListNode}\n */\nfunction reverseList(head) {\n\n}\n',
      typescript: 'function reverseList(head: ListNode | null): ListNode | null {\n\n}\n',
      java: 'class Solution {\n    public ListNode reverseList(ListNode head) {\n\n    }\n}\n',
    },
    timeLimit: 5000,
    memoryLimit: 256,
    tags: ['linked-list', 'recursion'],
    testCases: [
      {
        input: '[1,2,3,4,5]',
        expectedOutput: '[5,4,3,2,1]',
        description: 'Standard case',
        isHidden: false,
        sortOrder: 0,
      },
      {
        input: '[1,2]',
        expectedOutput: '[2,1]',
        description: 'Two elements',
        isHidden: false,
        sortOrder: 1,
      },
      {
        input: '[]',
        expectedOutput: '[]',
        description: 'Empty list',
        isHidden: false,
        sortOrder: 2,
      },
      {
        input: '[1]',
        expectedOutput: '[1]',
        description: 'Single element',
        isHidden: true,
        sortOrder: 3,
      },
    ],
  },

  // ---- Medium -------------------------------------------------------------
  {
    title: 'Longest Substring Without Repeating Characters',
    description:
      'Given a string `s`, find the length of the **longest substring** without repeating characters.',
    difficulty: 'medium',
    company: 'Amazon',
    constraints:
      '0 <= s.length <= 5 * 10^4\ns consists of English letters, digits, symbols and spaces.',
    examples: [
      {
        input: 's = "abcabcbb"',
        output: '3',
        explanation: 'The answer is "abc", with the length of 3.',
      },
      {
        input: 's = "bbbbb"',
        output: '1',
        explanation: 'The answer is "b", with the length of 1.',
      },
      {
        input: 's = "pwwkew"',
        output: '3',
        explanation: 'The answer is "wke", with the length of 3.',
      },
    ],
    starterCode: {
      python:
        'class Solution:\n    def lengthOfLongestSubstring(self, s: str) -> int:\n        pass\n',
      javascript:
        '/**\n * @param {string} s\n * @return {number}\n */\nfunction lengthOfLongestSubstring(s) {\n\n}\n',
      typescript: 'function lengthOfLongestSubstring(s: string): number {\n\n}\n',
      java: 'class Solution {\n    public int lengthOfLongestSubstring(String s) {\n\n    }\n}\n',
    },
    timeLimit: 5000,
    memoryLimit: 256,
    tags: ['string', 'hash-table', 'sliding-window'],
    testCases: [
      {
        input: 'abcabcbb',
        expectedOutput: '3',
        description: 'Repeating pattern',
        isHidden: false,
        sortOrder: 0,
      },
      {
        input: 'bbbbb',
        expectedOutput: '1',
        description: 'All same characters',
        isHidden: false,
        sortOrder: 1,
      },
      {
        input: 'pwwkew',
        expectedOutput: '3',
        description: 'Middle substring',
        isHidden: false,
        sortOrder: 2,
      },
      { input: '', expectedOutput: '0', description: 'Empty string', isHidden: true, sortOrder: 3 },
      {
        input: 'abcdef',
        expectedOutput: '6',
        description: 'All unique',
        isHidden: true,
        sortOrder: 4,
      },
      {
        input: 'aab',
        expectedOutput: '2',
        description: 'Short with repeat',
        isHidden: true,
        sortOrder: 5,
      },
    ],
  },
  {
    title: 'Binary Tree Level Order Traversal',
    description:
      "Given the `root` of a binary tree, return the level order traversal of its nodes' values. (i.e., from left to right, level by level).",
    difficulty: 'medium',
    company: 'Meta',
    constraints:
      'The number of nodes in the tree is in the range [0, 2000].\n-1000 <= Node.val <= 1000',
    examples: [
      { input: 'root = [3,9,20,null,null,15,7]', output: '[[3],[9,20],[15,7]]' },
      { input: 'root = [1]', output: '[[1]]' },
      { input: 'root = []', output: '[]' },
    ],
    starterCode: {
      python:
        '# class TreeNode:\n#     def __init__(self, val=0, left=None, right=None):\n#         self.val = val\n#         self.left = left\n#         self.right = right\n\nclass Solution:\n    def levelOrder(self, root: TreeNode | None) -> list[list[int]]:\n        pass\n',
      javascript:
        '/**\n * @param {TreeNode} root\n * @return {number[][]}\n */\nfunction levelOrder(root) {\n\n}\n',
      typescript: 'function levelOrder(root: TreeNode | null): number[][] {\n\n}\n',
      java: 'class Solution {\n    public List<List<Integer>> levelOrder(TreeNode root) {\n\n    }\n}\n',
    },
    timeLimit: 5000,
    memoryLimit: 256,
    tags: ['tree', 'queue'],
    testCases: [
      {
        input: '[3,9,20,null,null,15,7]',
        expectedOutput: '[[3],[9,20],[15,7]]',
        description: 'Standard tree',
        isHidden: false,
        sortOrder: 0,
      },
      {
        input: '[1]',
        expectedOutput: '[[1]]',
        description: 'Single node',
        isHidden: false,
        sortOrder: 1,
      },
      {
        input: '[]',
        expectedOutput: '[]',
        description: 'Empty tree',
        isHidden: false,
        sortOrder: 2,
      },
      {
        input: '[1,2,3,4,5]',
        expectedOutput: '[[1],[2,3],[4,5]]',
        description: 'Complete tree',
        isHidden: true,
        sortOrder: 3,
      },
    ],
  },
  {
    title: 'Coin Change',
    description:
      'You are given an integer array `coins` representing coins of different denominations and an integer `amount` representing a total amount of money.\n\nReturn the fewest number of coins that you need to make up that amount. If that amount of money cannot be made up by any combination of the coins, return `-1`.\n\nYou may assume that you have an infinite number of each kind of coin.',
    difficulty: 'medium',
    company: 'Google',
    constraints: '1 <= coins.length <= 12\n1 <= coins[i] <= 2^31 - 1\n0 <= amount <= 10^4',
    examples: [
      { input: 'coins = [1,5,10], amount = 12', output: '3', explanation: '12 = 10 + 1 + 1' },
      { input: 'coins = [2], amount = 3', output: '-1' },
      { input: 'coins = [1], amount = 0', output: '0' },
    ],
    starterCode: {
      python:
        'class Solution:\n    def coinChange(self, coins: list[int], amount: int) -> int:\n        pass\n',
      javascript:
        '/**\n * @param {number[]} coins\n * @param {number} amount\n * @return {number}\n */\nfunction coinChange(coins, amount) {\n\n}\n',
      typescript: 'function coinChange(coins: number[], amount: number): number {\n\n}\n',
      java: 'class Solution {\n    public int coinChange(int[] coins, int amount) {\n\n    }\n}\n',
    },
    timeLimit: 5000,
    memoryLimit: 256,
    tags: ['array', 'dynamic-programming'],
    testCases: [
      {
        input: '[1,5,10]\n12',
        expectedOutput: '3',
        description: 'Greedy-safe case',
        isHidden: false,
        sortOrder: 0,
      },
      {
        input: '[2]\n3',
        expectedOutput: '-1',
        description: 'Impossible',
        isHidden: false,
        sortOrder: 1,
      },
      {
        input: '[1]\n0',
        expectedOutput: '0',
        description: 'Zero amount',
        isHidden: false,
        sortOrder: 2,
      },
      {
        input: '[1,3,4]\n6',
        expectedOutput: '2',
        description: 'Greedy fails (3+3)',
        isHidden: true,
        sortOrder: 3,
      },
      {
        input: '[2,5,10,1]\n27',
        expectedOutput: '4',
        description: 'Multiple denominations',
        isHidden: true,
        sortOrder: 4,
      },
    ],
  },

  // ---- Hard ---------------------------------------------------------------
  {
    title: 'Merge K Sorted Lists',
    description:
      'You are given an array of `k` linked-lists `lists`, each linked-list is sorted in ascending order.\n\nMerge all the linked-lists into one sorted linked-list and return it.',
    difficulty: 'hard',
    company: 'Amazon',
    constraints:
      'k == lists.length\n0 <= k <= 10^4\n0 <= lists[i].length <= 500\n-10^4 <= lists[i][j] <= 10^4\nlists[i] is sorted in ascending order.\nThe sum of lists[i].length will not exceed 10^4.',
    examples: [
      { input: 'lists = [[1,4,5],[1,3,4],[2,6]]', output: '[1,1,2,3,4,4,5,6]' },
      { input: 'lists = []', output: '[]' },
      { input: 'lists = [[]]', output: '[]' },
    ],
    starterCode: {
      python:
        '# class ListNode:\n#     def __init__(self, val=0, next=None):\n#         self.val = val\n#         self.next = next\n\nclass Solution:\n    def mergeKLists(self, lists: list[ListNode | None]) -> ListNode | None:\n        pass\n',
      javascript:
        '/**\n * @param {ListNode[]} lists\n * @return {ListNode}\n */\nfunction mergeKLists(lists) {\n\n}\n',
      typescript: 'function mergeKLists(lists: (ListNode | null)[]): ListNode | null {\n\n}\n',
      java: 'class Solution {\n    public ListNode mergeKLists(ListNode[] lists) {\n\n    }\n}\n',
    },
    timeLimit: 5000,
    memoryLimit: 256,
    tags: ['linked-list', 'sorting'],
    testCases: [
      {
        input: '[[1,4,5],[1,3,4],[2,6]]',
        expectedOutput: '[1,1,2,3,4,4,5,6]',
        description: 'Three sorted lists',
        isHidden: false,
        sortOrder: 0,
      },
      {
        input: '[]',
        expectedOutput: '[]',
        description: 'Empty input',
        isHidden: false,
        sortOrder: 1,
      },
      {
        input: '[[]]',
        expectedOutput: '[]',
        description: 'Single empty list',
        isHidden: false,
        sortOrder: 2,
      },
      {
        input: '[[1],[2],[3]]',
        expectedOutput: '[1,2,3]',
        description: 'Single-element lists',
        isHidden: true,
        sortOrder: 3,
      },
      {
        input: '[[-2,-1,0],[0,1,2]]',
        expectedOutput: '[-2,-1,0,0,1,2]',
        description: 'Negative numbers',
        isHidden: true,
        sortOrder: 4,
      },
    ],
  },
  {
    title: 'Trapping Rain Water',
    description:
      'Given `n` non-negative integers representing an elevation map where the width of each bar is `1`, compute how much water it can trap after raining.',
    difficulty: 'hard',
    company: 'Google',
    constraints: 'n == height.length\n1 <= n <= 2 * 10^4\n0 <= height[i] <= 10^5',
    examples: [
      { input: 'height = [0,1,0,2,1,0,1,3,2,1,2,1]', output: '6' },
      { input: 'height = [4,2,0,3,2,5]', output: '9' },
    ],
    starterCode: {
      python: 'class Solution:\n    def trap(self, height: list[int]) -> int:\n        pass\n',
      javascript:
        '/**\n * @param {number[]} height\n * @return {number}\n */\nfunction trap(height) {\n\n}\n',
      typescript: 'function trap(height: number[]): number {\n\n}\n',
      java: 'class Solution {\n    public int trap(int[] height) {\n\n    }\n}\n',
    },
    timeLimit: 5000,
    memoryLimit: 256,
    tags: ['array', 'two-pointers', 'dynamic-programming'],
    testCases: [
      {
        input: '[0,1,0,2,1,0,1,3,2,1,2,1]',
        expectedOutput: '6',
        description: 'Classic example',
        isHidden: false,
        sortOrder: 0,
      },
      {
        input: '[4,2,0,3,2,5]',
        expectedOutput: '9',
        description: 'V-shape valleys',
        isHidden: false,
        sortOrder: 1,
      },
      {
        input: '[1,2,3,4,5]',
        expectedOutput: '0',
        description: 'Ascending — no trap',
        isHidden: true,
        sortOrder: 2,
      },
      {
        input: '[5,4,3,2,1]',
        expectedOutput: '0',
        description: 'Descending — no trap',
        isHidden: true,
        sortOrder: 3,
      },
      {
        input: '[3,0,3]',
        expectedOutput: '3',
        description: 'Single valley',
        isHidden: true,
        sortOrder: 4,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Seed execution
// ---------------------------------------------------------------------------
async function seed() {
  console.log('Seeding database...\n');

  // 1. Users
  const insertedUsers = await db
    .insert(schema.users)
    .values(usersData)
    .onConflictDoNothing()
    .returning({ id: schema.users.id, username: schema.users.username });
  console.log(`  Users:    ${insertedUsers.length} inserted`);

  // 2. Tags
  const insertedTags = await db
    .insert(schema.tags)
    .values(tagsData)
    .onConflictDoNothing()
    .returning({ id: schema.tags.id, slug: schema.tags.slug });
  console.log(`  Tags:     ${insertedTags.length} inserted`);

  // Build slug → id lookup from ALL tags (not just newly inserted ones)
  const allTags = await db.select({ id: schema.tags.id, slug: schema.tags.slug }).from(schema.tags);
  const tagsBySlug = new Map(allTags.map((t) => [t.slug, t.id]));

  // 3. Problems + test cases + tag links
  let problemCount = 0;
  let testCaseCount = 0;

  for (const p of problemsData) {
    const [inserted] = await db
      .insert(schema.problems)
      .values({
        title: p.title,
        description: p.description,
        difficulty: p.difficulty,
        company: p.company,
        constraints: p.constraints,
        examples: p.examples,
        starterCode: p.starterCode,
        timeLimit: p.timeLimit,
        memoryLimit: p.memoryLimit,
      })
      .onConflictDoNothing()
      .returning({ id: schema.problems.id });

    if (!inserted) {
      // Already exists — skip test cases and tags for this problem.
      continue;
    }

    problemCount++;

    // Test cases
    if (p.testCases.length > 0) {
      const insertedCases = await db
        .insert(schema.testCases)
        .values(p.testCases.map((tc) => ({ ...tc, problemId: inserted.id })))
        .onConflictDoNothing()
        .returning({ id: schema.testCases.id });
      testCaseCount += insertedCases.length;
    }

    // Problem ↔ tag links
    const tagLinks = p.tags
      .map((slug) => tagsBySlug.get(slug))
      .filter((id): id is string => id != null)
      .map((tagId) => ({ problemId: inserted.id, tagId }));

    if (tagLinks.length > 0) {
      await db.insert(schema.problemTags).values(tagLinks).onConflictDoNothing();
    }
  }

  console.log(`  Problems: ${problemCount} inserted`);
  console.log(`  Tests:    ${testCaseCount} inserted`);

  // 4. Global limits (ensure defaults exist — table may not exist if migration is pending)
  try {
    await db
      .insert(schema.globalLimits)
      .values([
        { key: 'ai_daily_limit', value: 100 },
        { key: 'execution_daily_limit', value: 100 },
        { key: 'rooms_max_active', value: 100 },
      ])
      .onConflictDoNothing();
    console.log('  Limits:   ensured defaults');
  } catch {
    console.log('  Limits:   skipped (table not found — run migrations first)');
  }

  console.log('\nSeed complete.');
}

try {
  await seed();
} catch (error) {
  console.error('Seed failed:', error);
  process.exit(1);
} finally {
  await client.end();
}
