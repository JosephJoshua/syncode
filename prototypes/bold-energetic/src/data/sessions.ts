export interface SessionRecord {
  id: string;
  date: string;
  problemId: string;
  partnerId: string;
  role: 'interviewer' | 'candidate';
  duration: number;
  language: string;
  scores: {
    overall: number;
    problemSolving: number;
    codeQuality: number;
    communication: number;
  };
  codeSnapshot: string;
}

export const sessions: SessionRecord[] = [
  {
    id: 's1',
    date: '2026-03-07',
    problemId: 'p1',
    partnerId: 'u2',
    role: 'candidate',
    duration: 35,
    language: 'javascript',
    scores: { overall: 88, problemSolving: 92, codeQuality: 85, communication: 87 },
    codeSnapshot:
      '// Two Sum\nfunction twoSum(nums, target) {\n  const map = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const complement = target - nums[i];\n    if (map.has(complement)) {\n      return [map.get(complement), i];\n    }\n    map.set(nums[i], i);\n  }\n  return [];\n}',
  },
  {
    id: 's2',
    date: '2026-03-06',
    problemId: 'p5',
    partnerId: 'u3',
    role: 'interviewer',
    duration: 42,
    language: 'python',
    scores: { overall: 76, problemSolving: 78, codeQuality: 72, communication: 80 },
    codeSnapshot:
      '# Add Two Numbers\nclass ListNode:\n    def __init__(self, val=0, next=None):\n        self.val = val\n        self.next = next\n\ndef addTwoNumbers(l1, l2):\n    dummy = ListNode(0)\n    curr = dummy\n    carry = 0\n    while l1 or l2 or carry:\n        v1 = l1.val if l1 else 0\n        v2 = l2.val if l2 else 0\n        total = v1 + v2 + carry\n        carry = total // 10\n        curr.next = ListNode(total % 10)\n        curr = curr.next\n        l1 = l1.next if l1 else None\n        l2 = l2.next if l2 else None\n    return dummy.next',
  },
  {
    id: 's3',
    date: '2026-03-05',
    problemId: 'p3',
    partnerId: 'u4',
    role: 'candidate',
    duration: 20,
    language: 'javascript',
    scores: { overall: 95, problemSolving: 98, codeQuality: 92, communication: 95 },
    codeSnapshot:
      '// Valid Parentheses\nfunction isValid(s) {\n  const stack = [];\n  const map = { ")": "(", "}": "{", "]": "[" };\n  for (const c of s) {\n    if (map[c]) {\n      if (stack.pop() !== map[c]) return false;\n    } else {\n      stack.push(c);\n    }\n  }\n  return stack.length === 0;\n}',
  },
  {
    id: 's4',
    date: '2026-03-04',
    problemId: 'p7',
    partnerId: 'u5',
    role: 'candidate',
    duration: 38,
    language: 'typescript',
    scores: { overall: 82, problemSolving: 85, codeQuality: 80, communication: 81 },
    codeSnapshot:
      '// Container With Most Water\nfunction maxArea(height: number[]): number {\n  let left = 0, right = height.length - 1;\n  let max = 0;\n  while (left < right) {\n    const area = Math.min(height[left], height[right]) * (right - left);\n    max = Math.max(max, area);\n    if (height[left] < height[right]) left++;\n    else right--;\n  }\n  return max;\n}',
  },
  {
    id: 's5',
    date: '2026-03-03',
    problemId: 'p9',
    partnerId: 'u2',
    role: 'interviewer',
    duration: 50,
    language: 'python',
    scores: { overall: 65, problemSolving: 60, codeQuality: 68, communication: 67 },
    codeSnapshot:
      '# Merge K Sorted Lists\nimport heapq\n\ndef mergeKLists(lists):\n    heap = []\n    for i, l in enumerate(lists):\n        if l:\n            heapq.heappush(heap, (l.val, i, l))\n    dummy = ListNode(0)\n    curr = dummy\n    while heap:\n        val, i, node = heapq.heappop(heap)\n        curr.next = node\n        curr = curr.next\n        if node.next:\n            heapq.heappush(heap, (node.next.val, i, node.next))\n    return dummy.next',
  },
  {
    id: 's6',
    date: '2026-03-02',
    problemId: 'p2',
    partnerId: 'u3',
    role: 'candidate',
    duration: 15,
    language: 'javascript',
    scores: { overall: 92, problemSolving: 95, codeQuality: 90, communication: 91 },
    codeSnapshot:
      '// Binary Search\nfunction search(nums, target) {\n  let left = 0, right = nums.length - 1;\n  while (left <= right) {\n    const mid = Math.floor((left + right) / 2);\n    if (nums[mid] === target) return mid;\n    if (nums[mid] < target) left = mid + 1;\n    else right = mid - 1;\n  }\n  return -1;\n}',
  },
  {
    id: 's7',
    date: '2026-03-01',
    problemId: 'p6',
    partnerId: 'u4',
    role: 'candidate',
    duration: 30,
    language: 'python',
    scores: { overall: 78, problemSolving: 80, codeQuality: 75, communication: 79 },
    codeSnapshot:
      '# Longest Substring Without Repeating\ndef lengthOfLongestSubstring(s):\n    char_set = set()\n    left = 0\n    max_len = 0\n    for right in range(len(s)):\n        while s[right] in char_set:\n            char_set.remove(s[left])\n            left += 1\n        char_set.add(s[right])\n        max_len = max(max_len, right - left + 1)\n    return max_len',
  },
  {
    id: 's8',
    date: '2026-02-28',
    problemId: 'p10',
    partnerId: 'u5',
    role: 'interviewer',
    duration: 55,
    language: 'typescript',
    scores: { overall: 70, problemSolving: 68, codeQuality: 72, communication: 70 },
    codeSnapshot:
      '// Trapping Rain Water\nfunction trap(height: number[]): number {\n  let left = 0, right = height.length - 1;\n  let leftMax = 0, rightMax = 0;\n  let water = 0;\n  while (left < right) {\n    if (height[left] < height[right]) {\n      leftMax = Math.max(leftMax, height[left]);\n      water += leftMax - height[left];\n      left++;\n    } else {\n      rightMax = Math.max(rightMax, height[right]);\n      water += rightMax - height[right];\n      right--;\n    }\n  }\n  return water;\n}',
  },
  {
    id: 's9',
    date: '2026-02-27',
    problemId: 'p4',
    partnerId: 'u2',
    role: 'candidate',
    duration: 25,
    language: 'javascript',
    scores: { overall: 85, problemSolving: 88, codeQuality: 82, communication: 85 },
    codeSnapshot:
      '// Merge Two Sorted Lists\nfunction mergeTwoLists(list1, list2) {\n  const dummy = { val: 0, next: null };\n  let curr = dummy;\n  while (list1 && list2) {\n    if (list1.val <= list2.val) {\n      curr.next = list1;\n      list1 = list1.next;\n    } else {\n      curr.next = list2;\n      list2 = list2.next;\n    }\n    curr = curr.next;\n  }\n  curr.next = list1 || list2;\n  return dummy.next;\n}',
  },
  {
    id: 's10',
    date: '2026-02-26',
    problemId: 'p8',
    partnerId: 'u3',
    role: 'interviewer',
    duration: 45,
    language: 'python',
    scores: { overall: 73, problemSolving: 75, codeQuality: 70, communication: 74 },
    codeSnapshot:
      '# 3Sum\ndef threeSum(nums):\n    nums.sort()\n    result = []\n    for i in range(len(nums) - 2):\n        if i > 0 and nums[i] == nums[i-1]:\n            continue\n        left, right = i + 1, len(nums) - 1\n        while left < right:\n            total = nums[i] + nums[left] + nums[right]\n            if total < 0:\n                left += 1\n            elif total > 0:\n                right -= 1\n            else:\n                result.append([nums[i], nums[left], nums[right]])\n                while left < right and nums[left] == nums[left+1]: left += 1\n                while left < right and nums[right] == nums[right-1]: right -= 1\n                left += 1\n                right -= 1\n    return result',
  },
];
