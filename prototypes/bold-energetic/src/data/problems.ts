export interface Problem {
  id: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  description: string;
  examples: { input: string; output: string }[];
  constraints: string[];
  bookmarked?: boolean;
}

export const problems: Problem[] = [
  {
    id: 'p1',
    title: 'Two Sum',
    difficulty: 'easy',
    tags: ['array', 'hash-table'],
    description:
      'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.',
    examples: [
      { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]' },
      { input: 'nums = [3,2,4], target = 6', output: '[1,2]' },
    ],
    constraints: [
      '2 <= nums.length <= 10^4',
      '-10^9 <= nums[i] <= 10^9',
      'Only one valid answer exists',
    ],
    bookmarked: true,
  },
  {
    id: 'p2',
    title: 'Binary Search',
    difficulty: 'easy',
    tags: ['array', 'binary-search'],
    description:
      'Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums.',
    examples: [{ input: 'nums = [-1,0,3,5,9,12], target = 9', output: '4' }],
    constraints: [
      '1 <= nums.length <= 10^4',
      '-10^4 < nums[i], target < 10^4',
      'All integers in nums are unique',
      'nums is sorted in ascending order',
    ],
  },
  {
    id: 'p3',
    title: 'Valid Parentheses',
    difficulty: 'easy',
    tags: ['string', 'stack'],
    description:
      "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.",
    examples: [
      { input: 's = "()"', output: 'true' },
      { input: 's = "()[]{}"', output: 'true' },
    ],
    constraints: ['1 <= s.length <= 10^4', "s consists of parentheses only '()[]{}'"],
  },
  {
    id: 'p4',
    title: 'Merge Two Sorted Lists',
    difficulty: 'easy',
    tags: ['linked-list'],
    description:
      'You are given the heads of two sorted linked lists. Merge the two lists into one sorted list.',
    examples: [{ input: 'list1 = [1,2,4], list2 = [1,3,4]', output: '[1,1,2,3,4,4]' }],
    constraints: [
      'The number of nodes in both lists is in the range [0, 50]',
      '-100 <= Node.val <= 100',
    ],
  },
  {
    id: 'p5',
    title: 'Add Two Numbers',
    difficulty: 'medium',
    tags: ['linked-list', 'math'],
    description:
      'You are given two non-empty linked lists representing two non-negative integers stored in reverse order.',
    examples: [{ input: 'l1 = [2,4,3], l2 = [5,6,4]', output: '[7,0,8]' }],
    constraints: ['Each list contains [1, 100] nodes', '0 <= Node.val <= 9'],
    bookmarked: true,
  },
  {
    id: 'p6',
    title: 'Longest Substring Without Repeating',
    difficulty: 'medium',
    tags: ['string', 'hash-table', 'sliding-window'],
    description:
      'Given a string s, find the length of the longest substring without repeating characters.',
    examples: [
      { input: 's = "abcabcbb"', output: '3' },
      { input: 's = "bbbbb"', output: '1' },
    ],
    constraints: [
      '0 <= s.length <= 5 * 10^4',
      's consists of English letters, digits, symbols and spaces',
    ],
  },
  {
    id: 'p7',
    title: 'Container With Most Water',
    difficulty: 'medium',
    tags: ['array', 'two-pointers'],
    description:
      'You are given an integer array height of length n. Find two lines that together with the x-axis form a container that holds the most water.',
    examples: [{ input: 'height = [1,8,6,2,5,4,8,3,7]', output: '49' }],
    constraints: ['n == height.length', '2 <= n <= 10^5', '0 <= height[i] <= 10^4'],
  },
  {
    id: 'p8',
    title: '3Sum',
    difficulty: 'medium',
    tags: ['array', 'two-pointers', 'sorting'],
    description:
      'Given an integer array nums, return all the triplets [nums[i], nums[j], nums[k]] such that i != j, i != k, and j != k, and nums[i] + nums[j] + nums[k] == 0.',
    examples: [{ input: 'nums = [-1,0,1,2,-1,-4]', output: '[[-1,-1,2],[-1,0,1]]' }],
    constraints: ['3 <= nums.length <= 3000', '-10^5 <= nums[i] <= 10^5'],
    bookmarked: true,
  },
  {
    id: 'p9',
    title: 'Merge K Sorted Lists',
    difficulty: 'hard',
    tags: ['linked-list', 'heap'],
    description:
      'You are given an array of k linked-lists, each sorted in ascending order. Merge all lists into one sorted list.',
    examples: [{ input: 'lists = [[1,4,5],[1,3,4],[2,6]]', output: '[1,1,2,3,4,4,5,6]' }],
    constraints: ['k == lists.length', '0 <= k <= 10^4', '0 <= lists[i].length <= 500'],
  },
  {
    id: 'p10',
    title: 'Trapping Rain Water',
    difficulty: 'hard',
    tags: ['array', 'dynamic-programming', 'two-pointers'],
    description:
      'Given n non-negative integers representing an elevation map where the width of each bar is 1, compute how much water it can trap after raining.',
    examples: [{ input: 'height = [0,1,0,2,1,0,1,3,2,1,2,1]', output: '6' }],
    constraints: ['n == height.length', '1 <= n <= 2 * 10^4', '0 <= height[i] <= 10^5'],
  },
  {
    id: 'p11',
    title: 'Word Ladder',
    difficulty: 'hard',
    tags: ['string', 'graph', 'bfs'],
    description:
      'Given two words beginWord and endWord, and a dictionary wordList, return the number of words in the shortest transformation sequence.',
    examples: [
      {
        input:
          'beginWord = "hit", endWord = "cog", wordList = ["hot","dot","dog","lot","log","cog"]',
        output: '5',
      },
    ],
    constraints: [
      '1 <= beginWord.length <= 10',
      'endWord.length == beginWord.length',
      '1 <= wordList.length <= 5000',
    ],
  },
  {
    id: 'p12',
    title: 'Serialize and Deserialize Binary Tree',
    difficulty: 'hard',
    tags: ['tree', 'design'],
    description: 'Design an algorithm to serialize and deserialize a binary tree.',
    examples: [{ input: 'root = [1,2,3,null,null,4,5]', output: '[1,2,3,null,null,4,5]' }],
    constraints: [
      'The number of nodes in the tree is in the range [0, 10^4]',
      '-1000 <= Node.val <= 1000',
    ],
  },
];
