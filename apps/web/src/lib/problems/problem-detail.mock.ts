import type { ProblemDetailErrorResponse, ProblemDetailResponse } from './problem-detail.types';

export const canonicalProblemDetailMock: ProblemDetailResponse = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  title: 'Two Sum',
  difficulty: 'easy',
  tags: ['array', 'hash-table'],
  company: 'Google',
  acceptanceRate: 49.3,
  isBookmarked: true,
  attemptStatus: 'attempted',
  testCaseCount: 6,
  hiddenTestCaseCount: 3,
  totalSubmissions: 1843201,
  updatedAt: '2026-03-28T10:15:00.000Z',
  description: [
    'Given an array of integers `nums` and an integer `target`, return the indices of the two numbers such that they add up to `target`.',
    '',
    'You may assume that each input would have **exactly one solution**, and you may not use the same element twice.',
    '',
    'You can return the answer in any order.',
  ].join('\n'),
  constraints: [
    '- `2 <= nums.length <= 10^4`',
    '- `-10^9 <= nums[i] <= 10^9`',
    '- `-10^9 <= target <= 10^9`',
    '- Only one valid answer exists.',
  ].join('\n'),
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
    {
      input: 'nums = [3,3], target = 6',
      output: '[0,1]',
    },
  ],
  testCases: [
    {
      input: '[2,7,11,15]\n9',
      expectedOutput: '[0,1]',
      description: 'Basic positive-number case',
      isHidden: false,
      timeoutMs: 1000,
      memoryMb: 128,
    },
    {
      input: '[3,2,4]\n6',
      expectedOutput: '[1,2]',
      description: 'Requires checking later elements',
      isHidden: false,
      timeoutMs: 1000,
      memoryMb: 128,
    },
    {
      input: '[3,3]\n6',
      expectedOutput: '[0,1]',
      description: 'Duplicate values still produce distinct indices',
      isHidden: false,
      timeoutMs: 1000,
      memoryMb: 128,
    },
    {
      input: '[-1,-2,-3,-4,-5]\n-8',
      expectedOutput: '[2,4]',
      description: 'Negative numbers',
      isHidden: true,
      timeoutMs: 1000,
      memoryMb: 128,
    },
    {
      input: '[0,4,3,0]\n0',
      expectedOutput: '[0,3]',
      description: 'Zero pairing edge case',
      isHidden: true,
      timeoutMs: 1200,
      memoryMb: 128,
    },
    {
      input: '[1000000000,-1000000000,5,7]\n0',
      expectedOutput: '[0,1]',
      description: 'Large magnitude integers',
      isHidden: true,
      timeoutMs: 1200,
      memoryMb: 192,
    },
  ],
  starterCode: {
    python: [
      'from typing import List',
      '',
      'class Solution:',
      '    def twoSum(self, nums: List[int], target: int) -> List[int]:',
      '        # Write your solution here',
      '        return []',
    ].join('\n'),
    javascript: [
      '/**',
      ' * @param {number[]} nums',
      ' * @param {number} target',
      ' * @return {number[]}',
      ' */',
      'function twoSum(nums, target) {',
      '  // Write your solution here',
      '  return [];',
      '}',
    ].join('\n'),
    typescript: [
      'function twoSum(nums: number[], target: number): number[] {',
      '  // Write your solution here',
      '  return [];',
      '}',
    ].join('\n'),
    java: [
      'class Solution {',
      '  public int[] twoSum(int[] nums, int target) {',
      '    // Write your solution here',
      '    return new int[] {};',
      '  }',
      '}',
    ].join('\n'),
    cpp: [
      'class Solution {',
      'public:',
      '  vector<int> twoSum(vector<int>& nums, int target) {',
      '    // Write your solution here',
      '    return {};',
      '  }',
      '};',
    ].join('\n'),
    c: [
      '#include <stdlib.h>',
      '',
      'int* twoSum(int* nums, int numsSize, int target, int* returnSize) {',
      '  // Write your solution here',
      '  *returnSize = 0;',
      '  return NULL;',
      '}',
    ].join('\n'),
    go: [
      'func twoSum(nums []int, target int) []int {',
      '    // Write your solution here',
      '    return []int{}',
      '}',
    ].join('\n'),
    rust: [
      'impl Solution {',
      '    pub fn two_sum(nums: Vec<i32>, target: i32) -> Vec<i32> {',
      '        // Write your solution here',
      '        vec![]',
      '    }',
      '}',
    ].join('\n'),
  },
  userAttempts: 4,
  createdAt: '2026-02-18T08:30:00.000Z',
};

export const secondaryProblemDetailMock: ProblemDetailResponse = {
  id: '6b7f3c96-4ab0-471f-98f3-8e09f6353bf5',
  title: 'Valid Parentheses',
  difficulty: 'easy',
  tags: ['stack', 'string'],
  company: null,
  acceptanceRate: null,
  isBookmarked: false,
  attemptStatus: null,
  totalSubmissions: 0,
  updatedAt: '2026-03-15T12:00:00.000Z',
  description:
    'Given a string `s` containing just the characters `()[]{}`, determine if the input string is valid.',
  constraints: null,
  examples: [
    {
      input: 's = "()"',
      output: 'true',
    },
  ],
  testCases: [
    {
      input: '"()"',
      expectedOutput: 'true',
      isHidden: false,
    },
  ],
  starterCode: {
    python: [
      'class Solution:',
      '    def isValid(self, s: str) -> bool:',
      '        return False',
    ].join('\n'),
  },
  userAttempts: 0,
  createdAt: '2026-03-10T07:45:00.000Z',
};

function createInitialProblemDetailMockRecords(): Record<string, ProblemDetailResponse> {
  return {
    [canonicalProblemDetailMock.id]: cloneProblemDetail(canonicalProblemDetailMock),
    [secondaryProblemDetailMock.id]: cloneProblemDetail(secondaryProblemDetailMock),
  };
}

export let problemDetailMockRecords: Record<string, ProblemDetailResponse> =
  createInitialProblemDetailMockRecords();

function cloneProblemDetail(problem: ProblemDetailResponse): ProblemDetailResponse {
  return {
    ...problem,
    tags: [...problem.tags],
    examples: problem.examples.map((example) => ({ ...example })),
    testCases: problem.testCases.map((testCase) => ({ ...testCase })),
    starterCode: problem.starterCode ? { ...problem.starterCode } : null,
  };
}

export function getMockProblemDetail(problemId: string): ProblemDetailResponse | null {
  const problem = problemDetailMockRecords[problemId];

  return problem ? cloneProblemDetail(problem) : null;
}

export function setMockProblemBookmark(problemId: string, isBookmarked: boolean) {
  const problem = problemDetailMockRecords[problemId];

  if (!problem) {
    return null;
  }

  const updatedProblem = {
    ...problem,
    isBookmarked,
  };

  problemDetailMockRecords = {
    ...problemDetailMockRecords,
    [problemId]: updatedProblem,
  };

  return cloneProblemDetail(updatedProblem);
}

export function resetProblemDetailMockRecords() {
  problemDetailMockRecords = createInitialProblemDetailMockRecords();
}

export function createProblemDetailNotFoundError(problemId: string): ProblemDetailErrorResponse {
  return {
    statusCode: 404,
    code: 'PROBLEM_NOT_FOUND',
    message: 'Problem not found',
    timestamp: '2026-04-06T00:00:00.000Z',
    details: {
      problemId,
    },
  };
}
