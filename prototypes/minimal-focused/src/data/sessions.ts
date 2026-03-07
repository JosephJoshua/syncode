export interface SessionRecord {
  id: string;
  date: string;
  problemId: string;
  partnerId: string;
  role: 'interviewer' | 'candidate';
  duration: number;
  scores: {
    overall: number;
    problemSolving: number;
    codeQuality: number;
    communication: number;
  };
  language: string;
  codeSnapshot: string;
}

export const sessions: SessionRecord[] = [
  {
    id: 's1',
    date: '2026-03-06',
    problemId: 'p1',
    partnerId: '2',
    role: 'candidate',
    duration: 35,
    scores: { overall: 82, problemSolving: 85, codeQuality: 78, communication: 83 },
    language: 'python',
    codeSnapshot:
      'def two_sum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        diff = target - n\n        if diff in seen:\n            return [seen[diff], i]\n        seen[n] = i\n    return []',
  },
  {
    id: 's2',
    date: '2026-03-05',
    problemId: 'p4',
    partnerId: '3',
    role: 'interviewer',
    duration: 42,
    scores: { overall: 71, problemSolving: 68, codeQuality: 75, communication: 70 },
    language: 'javascript',
    codeSnapshot:
      'function lengthOfLongestSubstring(s) {\n  const set = new Set();\n  let left = 0, max = 0;\n  for (let right = 0; right < s.length; right++) {\n    while (set.has(s[right])) set.delete(s[left++]);\n    set.add(s[right]);\n    max = Math.max(max, right - left + 1);\n  }\n  return max;\n}',
  },
  {
    id: 's3',
    date: '2026-03-04',
    problemId: 'p10',
    partnerId: '4',
    role: 'candidate',
    duration: 55,
    scores: { overall: 60, problemSolving: 55, codeQuality: 65, communication: 60 },
    language: 'python',
    codeSnapshot:
      'def trap(height):\n    left, right = 0, len(height) - 1\n    left_max = right_max = 0\n    water = 0\n    while left < right:\n        if height[left] < height[right]:\n            left_max = max(left_max, height[left])\n            water += left_max - height[left]\n            left += 1\n        else:\n            right_max = max(right_max, height[right])\n            water += right_max - height[right]\n            right -= 1\n    return water',
  },
  {
    id: 's4',
    date: '2026-03-03',
    problemId: 'p2',
    partnerId: '5',
    role: 'candidate',
    duration: 20,
    scores: { overall: 95, problemSolving: 95, codeQuality: 95, communication: 95 },
    language: 'typescript',
    codeSnapshot:
      'function isValid(s: string): boolean {\n  const stack: string[] = [];\n  const map: Record<string, string> = { ")": "(", "]": "[", "}": "{" };\n  for (const c of s) {\n    if (map[c]) {\n      if (stack.pop() !== map[c]) return false;\n    } else {\n      stack.push(c);\n    }\n  }\n  return stack.length === 0;\n}',
  },
  {
    id: 's5',
    date: '2026-03-02',
    problemId: 'p6',
    partnerId: '2',
    role: 'interviewer',
    duration: 48,
    scores: { overall: 77, problemSolving: 80, codeQuality: 72, communication: 79 },
    language: 'python',
    codeSnapshot:
      'class LRUCache:\n    def __init__(self, capacity):\n        self.cap = capacity\n        self.cache = OrderedDict()\n\n    def get(self, key):\n        if key not in self.cache: return -1\n        self.cache.move_to_end(key)\n        return self.cache[key]\n\n    def put(self, key, value):\n        if key in self.cache:\n            self.cache.move_to_end(key)\n        self.cache[key] = value\n        if len(self.cache) > self.cap:\n            self.cache.popitem(last=False)',
  },
  {
    id: 's6',
    date: '2026-03-01',
    problemId: 'p8',
    partnerId: '1',
    role: 'candidate',
    duration: 38,
    scores: { overall: 88, problemSolving: 90, codeQuality: 85, communication: 89 },
    language: 'python',
    codeSnapshot:
      'def canFinish(numCourses, prerequisites):\n    graph = defaultdict(list)\n    indegree = [0] * numCourses\n    for a, b in prerequisites:\n        graph[b].append(a)\n        indegree[a] += 1\n    queue = deque(i for i in range(numCourses) if indegree[i] == 0)\n    count = 0\n    while queue:\n        node = queue.popleft()\n        count += 1\n        for nei in graph[node]:\n            indegree[nei] -= 1\n            if indegree[nei] == 0:\n                queue.append(nei)\n    return count == numCourses',
  },
  {
    id: 's7',
    date: '2026-02-28',
    problemId: 'p3',
    partnerId: '3',
    role: 'candidate',
    duration: 25,
    scores: { overall: 90, problemSolving: 92, codeQuality: 88, communication: 90 },
    language: 'javascript',
    codeSnapshot:
      'function mergeTwoLists(list1, list2) {\n  const dummy = { val: 0, next: null };\n  let curr = dummy;\n  while (list1 && list2) {\n    if (list1.val <= list2.val) {\n      curr.next = list1;\n      list1 = list1.next;\n    } else {\n      curr.next = list2;\n      list2 = list2.next;\n    }\n    curr = curr.next;\n  }\n  curr.next = list1 || list2;\n  return dummy.next;\n}',
  },
  {
    id: 's8',
    date: '2026-02-27',
    problemId: 'p9',
    partnerId: '4',
    role: 'interviewer',
    duration: 58,
    scores: { overall: 65, problemSolving: 60, codeQuality: 70, communication: 65 },
    language: 'python',
    codeSnapshot:
      'import heapq\n\ndef mergeKLists(lists):\n    heap = []\n    for i, l in enumerate(lists):\n        if l:\n            heapq.heappush(heap, (l.val, i, l))\n    dummy = curr = ListNode(0)\n    while heap:\n        val, i, node = heapq.heappop(heap)\n        curr.next = node\n        curr = curr.next\n        if node.next:\n            heapq.heappush(heap, (node.next.val, i, node.next))\n    return dummy.next',
  },
  {
    id: 's9',
    date: '2026-02-26',
    problemId: 'p7',
    partnerId: '5',
    role: 'candidate',
    duration: 30,
    scores: { overall: 85, problemSolving: 83, codeQuality: 88, communication: 84 },
    language: 'typescript',
    codeSnapshot:
      'function levelOrder(root: TreeNode | null): number[][] {\n  if (!root) return [];\n  const result: number[][] = [];\n  const queue: TreeNode[] = [root];\n  while (queue.length) {\n    const level: number[] = [];\n    const size = queue.length;\n    for (let i = 0; i < size; i++) {\n      const node = queue.shift()!;\n      level.push(node.val);\n      if (node.left) queue.push(node.left);\n      if (node.right) queue.push(node.right);\n    }\n    result.push(level);\n  }\n  return result;\n}',
  },
  {
    id: 's10',
    date: '2026-02-25',
    problemId: 'p5',
    partnerId: '1',
    role: 'interviewer',
    duration: 40,
    scores: { overall: 74, problemSolving: 70, codeQuality: 78, communication: 74 },
    language: 'python',
    codeSnapshot:
      'def addTwoNumbers(l1, l2):\n    dummy = curr = ListNode(0)\n    carry = 0\n    while l1 or l2 or carry:\n        val = carry\n        if l1:\n            val += l1.val\n            l1 = l1.next\n        if l2:\n            val += l2.val\n            l2 = l2.next\n        carry, val = divmod(val, 10)\n        curr.next = ListNode(val)\n        curr = curr.next\n    return dummy.next',
  },
];
