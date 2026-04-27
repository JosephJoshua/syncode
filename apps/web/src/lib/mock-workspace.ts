import type { ProblemData } from '@/components/room-problem-panel.js';

export const MOCK_WORKSPACE_PROBLEM: ProblemData = {
  title: 'Two Sum',
  difficulty: 'easy',
  tags: ['array', 'hash-table'],
  description:
    'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\n\nYou may assume that each input has exactly one solution, and you may not use the same element twice.\n\nReturn the answer in any order.',
  constraints:
    '2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9\nOnly one valid answer exists.',
  examples: [
    {
      input: 'nums = [2,7,11,15], target = 9',
      output: '[0,1]',
      explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].',
    },
    {
      input: 'nums = [3,2,4], target = 6',
      output: '[1,2]',
    },
  ],
};

export const MOCK_WORKSPACE_TEST_CASES = [
  {
    input: '2 7 11 15\n9',
    expectedOutput: '0 1',
  },
  {
    input: '3 2 4\n6',
    expectedOutput: '1 2',
  },
] as const;

export const MOCK_INLINE_COMMENTS = [
  {
    lineNumber: 2,
    content: 'Start by checking whether the current value already has a complement in the map.',
  },
  {
    lineNumber: 6,
    content: 'Return early once you find the pair so the happy path stays obvious.',
  },
] as const;

export const MOCK_WORKSPACE_CODE = `def two_sum(nums, target):
    seen = {}

    for index, value in enumerate(nums):
        complement = target - value
        if complement in seen:
            return [seen[complement], index]

        seen[value] = index

    return []
`;
