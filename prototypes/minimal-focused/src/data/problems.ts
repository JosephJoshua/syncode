export interface Problem {
  id: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  description: string;
  examples: { input: string; output: string }[];
  constraints: string[];
}

export const problems: Problem[] = [
  {
    id: 'p1',
    title: 'Two Sum',
    difficulty: 'easy',
    tags: ['array', 'hash-table'],
    description:
      'Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have **exactly one solution**, and you may not use the same element twice.',
    examples: [
      { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]' },
      { input: 'nums = [3,2,4], target = 6', output: '[1,2]' },
    ],
    constraints: [
      '2 <= nums.length <= 10^4',
      '-10^9 <= nums[i] <= 10^9',
      '-10^9 <= target <= 10^9',
      'Only one valid answer exists.',
    ],
  },
  {
    id: 'p2',
    title: 'Valid Parentheses',
    difficulty: 'easy',
    tags: ['string', 'stack'],
    description:
      'Given a string `s` containing just the characters `(`, `)`, `{`, `}`, `[` and `]`, determine if the input string is valid.\n\nAn input string is valid if:\n1. Open brackets must be closed by the same type of brackets.\n2. Open brackets must be closed in the correct order.\n3. Every close bracket has a corresponding open bracket of the same type.',
    examples: [
      { input: 's = "()"', output: 'true' },
      { input: 's = "()[]{}"', output: 'true' },
      { input: 's = "(]"', output: 'false' },
    ],
    constraints: ['1 <= s.length <= 10^4', 's consists of parentheses only `()[]{}`.'],
  },
  {
    id: 'p3',
    title: 'Merge Two Sorted Lists',
    difficulty: 'easy',
    tags: ['linked-list', 'recursion'],
    description:
      'You are given the heads of two sorted linked lists `list1` and `list2`. Merge the two lists into one **sorted** list. The list should be made by splicing together the nodes of the first two lists.\n\nReturn the head of the merged linked list.',
    examples: [
      { input: 'list1 = [1,2,4], list2 = [1,3,4]', output: '[1,1,2,3,4,4]' },
      { input: 'list1 = [], list2 = []', output: '[]' },
    ],
    constraints: [
      'The number of nodes in both lists is in the range [0, 50].',
      '-100 <= Node.val <= 100',
      'Both lists are sorted in non-decreasing order.',
    ],
  },
  {
    id: 'p4',
    title: 'Longest Substring Without Repeating Characters',
    difficulty: 'medium',
    tags: ['string', 'sliding-window', 'hash-table'],
    description:
      'Given a string `s`, find the length of the **longest substring** without repeating characters.',
    examples: [
      { input: 's = "abcabcbb"', output: '3' },
      { input: 's = "bbbbb"', output: '1' },
      { input: 's = "pwwkew"', output: '3' },
    ],
    constraints: [
      '0 <= s.length <= 5 * 10^4',
      's consists of English letters, digits, symbols and spaces.',
    ],
  },
  {
    id: 'p5',
    title: 'Add Two Numbers',
    difficulty: 'medium',
    tags: ['linked-list', 'math', 'recursion'],
    description:
      'You are given two **non-empty** linked lists representing two non-negative integers. The digits are stored in **reverse order**, and each of their nodes contains a single digit. Add the two numbers and return the sum as a linked list.',
    examples: [
      { input: 'l1 = [2,4,3], l2 = [5,6,4]', output: '[7,0,8]' },
      { input: 'l1 = [0], l2 = [0]', output: '[0]' },
    ],
    constraints: [
      'The number of nodes in each linked list is in the range [1, 100].',
      '0 <= Node.val <= 9',
      'The list does not contain leading zeros except the number 0 itself.',
    ],
  },
  {
    id: 'p6',
    title: 'LRU Cache',
    difficulty: 'medium',
    tags: ['hash-table', 'linked-list', 'design'],
    description:
      'Design a data structure that follows the constraints of a **Least Recently Used (LRU) cache**.\n\nImplement the `LRUCache` class:\n- `LRUCache(int capacity)` Initialize the LRU cache with positive size capacity.\n- `int get(int key)` Return the value of the key if it exists, otherwise return -1.\n- `void put(int key, int value)` Update or insert the value. When the cache reaches capacity, evict the least recently used key.',
    examples: [
      {
        input:
          '["LRUCache","put","put","get","put","get","put","get","get","get"]\n[[2],[1,1],[2,2],[1],[3,3],[2],[4,4],[1],[3],[4]]',
        output: '[null,null,null,1,null,-1,null,-1,3,4]',
      },
    ],
    constraints: ['1 <= capacity <= 3000', '0 <= key <= 10^4', '0 <= value <= 10^5'],
  },
  {
    id: 'p7',
    title: 'Binary Tree Level Order Traversal',
    difficulty: 'medium',
    tags: ['tree', 'bfs', 'binary-tree'],
    description:
      "Given the `root` of a binary tree, return the **level order traversal** of its nodes' values. (i.e., from left to right, level by level).",
    examples: [
      { input: 'root = [3,9,20,null,null,15,7]', output: '[[3],[9,20],[15,7]]' },
      { input: 'root = [1]', output: '[[1]]' },
    ],
    constraints: [
      'The number of nodes in the tree is in the range [0, 2000].',
      '-1000 <= Node.val <= 1000',
    ],
  },
  {
    id: 'p8',
    title: 'Course Schedule',
    difficulty: 'medium',
    tags: ['graph', 'topological-sort', 'bfs', 'dfs'],
    description:
      'There are a total of `numCourses` courses you have to take, labeled from `0` to `numCourses - 1`. You are given an array `prerequisites` where `prerequisites[i] = [ai, bi]` indicates that you must take course `bi` first if you want to take course `ai`.\n\nReturn `true` if you can finish all courses. Otherwise, return `false`.',
    examples: [
      { input: 'numCourses = 2, prerequisites = [[1,0]]', output: 'true' },
      { input: 'numCourses = 2, prerequisites = [[1,0],[0,1]]', output: 'false' },
    ],
    constraints: [
      '1 <= numCourses <= 2000',
      '0 <= prerequisites.length <= 5000',
      'prerequisites[i].length == 2',
      'All the pairs are unique.',
    ],
  },
  {
    id: 'p9',
    title: 'Merge K Sorted Lists',
    difficulty: 'hard',
    tags: ['linked-list', 'divide-and-conquer', 'heap'],
    description:
      'You are given an array of `k` linked-lists `lists`, each linked-list is sorted in ascending order.\n\nMerge all the linked-lists into one sorted linked-list and return it.',
    examples: [
      { input: 'lists = [[1,4,5],[1,3,4],[2,6]]', output: '[1,1,2,3,4,4,5,6]' },
      { input: 'lists = []', output: '[]' },
    ],
    constraints: [
      'k == lists.length',
      '0 <= k <= 10^4',
      '0 <= lists[i].length <= 500',
      '-10^4 <= lists[i][j] <= 10^4',
    ],
  },
  {
    id: 'p10',
    title: 'Trapping Rain Water',
    difficulty: 'hard',
    tags: ['array', 'two-pointers', 'dynamic-programming', 'stack'],
    description:
      'Given `n` non-negative integers representing an elevation map where the width of each bar is 1, compute how much water it can trap after raining.',
    examples: [
      { input: 'height = [0,1,0,2,1,0,1,3,2,1,2,1]', output: '6' },
      { input: 'height = [4,2,0,3,2,5]', output: '9' },
    ],
    constraints: ['n == height.length', '1 <= n <= 2 * 10^4', '0 <= height[i] <= 10^5'],
  },
  {
    id: 'p11',
    title: 'Word Ladder',
    difficulty: 'hard',
    tags: ['bfs', 'hash-table', 'string'],
    description:
      'A **transformation sequence** from word `beginWord` to word `endWord` using a dictionary `wordList` is a sequence of words `beginWord -> s1 -> s2 -> ... -> sk` such that:\n- Every adjacent pair of words differs by a single letter.\n- Every `si` for `1 <= i <= k` is in `wordList`.\n\nGiven two words and a dictionary, return the **number of words** in the shortest transformation sequence, or `0` if no such sequence exists.',
    examples: [
      {
        input:
          'beginWord = "hit", endWord = "cog", wordList = ["hot","dot","dog","lot","log","cog"]',
        output: '5',
      },
      {
        input: 'beginWord = "hit", endWord = "cog", wordList = ["hot","dot","dog","lot","log"]',
        output: '0',
      },
    ],
    constraints: [
      '1 <= beginWord.length <= 10',
      'endWord.length == beginWord.length',
      '1 <= wordList.length <= 5000',
      'All words have the same length and consist of lowercase English letters.',
    ],
  },
  {
    id: 'p12',
    title: 'Serialize and Deserialize Binary Tree',
    difficulty: 'hard',
    tags: ['tree', 'design', 'bfs', 'dfs', 'binary-tree'],
    description:
      'Design an algorithm to serialize and deserialize a binary tree. There is no restriction on how your serialization/deserialization algorithm should work. You just need to ensure that a binary tree can be serialized to a string and this string can be deserialized to the original tree structure.',
    examples: [
      { input: 'root = [1,2,3,null,null,4,5]', output: '[1,2,3,null,null,4,5]' },
      { input: 'root = []', output: '[]' },
    ],
    constraints: [
      'The number of nodes in the tree is in the range [0, 10^4].',
      '-1000 <= Node.val <= 1000',
    ],
  },
];
