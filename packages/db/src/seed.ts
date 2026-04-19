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
    description: [
      'Given an array of N integers and a target, find two 0-based indices whose values sum to the target.',
      '',
      'You may assume each input has exactly one solution, and you may not use the same element twice.',
      '',
      '## Input Format',
      'The first line contains two integers N and target.',
      'The second line contains N space-separated integers a[0], a[1], ..., a[N-1].',
      '',
      '## Output Format',
      'Print two 0-based indices i and j with i < j such that a[i] + a[j] = target.',
      '',
      '## Constraints',
      '- 2 <= N <= 10^4',
      '- -10^9 <= a[i], target <= 10^9',
      '- Exactly one valid answer exists.',
      '',
      '## Example',
      'Input:',
      '```',
      '4 9',
      '2 7 11 15',
      '```',
      'Output:',
      '```',
      '0 1',
      '```',
    ].join('\n'),
    difficulty: 'easy',
    company: 'Google',
    constraints:
      '2 <= N <= 10^4\n-10^9 <= a[i] <= 10^9\n-10^9 <= target <= 10^9\nExactly one valid answer exists.',
    examples: [
      {
        input: '4 9\n2 7 11 15',
        output: '0 1',
        explanation: 'a[0] + a[1] = 2 + 7 = 9.',
      },
      { input: '3 6\n3 2 4', output: '1 2' },
      { input: '2 6\n3 3', output: '0 1' },
    ],
    starterCode: {
      python:
        "import sys\n\ndef solve(nums, target):\n    # TODO: your solution here\n    return (0, 0)\n\ndef main():\n    data = sys.stdin.read().split()\n    n = int(data[0])\n    target = int(data[1])\n    nums = [int(x) for x in data[2:2 + n]]\n    i, j = solve(nums, target)\n    print(f'{i} {j}')\n\nif __name__ == '__main__':\n    main()\n",
      javascript:
        "const tokens = require('fs').readFileSync(0, 'utf-8').trim().split(/\\s+/);\nconst n = Number(tokens[0]);\nconst target = Number(tokens[1]);\nconst nums = tokens.slice(2, 2 + n).map(Number);\n\nfunction solve(nums, target) {\n  // TODO: your solution here\n  return [0, 0];\n}\n\nconst [i, j] = solve(nums, target);\nconsole.log(`${i} ${j}`);\n",
      typescript:
        "const tokens = require('fs').readFileSync(0, 'utf-8').trim().split(/\\s+/) as string[];\nconst n = Number(tokens[0]);\nconst target = Number(tokens[1]);\nconst nums: number[] = tokens.slice(2, 2 + n).map(Number);\n\nfunction solve(nums: number[], target: number): [number, number] {\n  // TODO: your solution here\n  return [0, 0];\n}\n\nconst [i, j] = solve(nums, target);\nconsole.log(`${i} ${j}`);\n",
      java: 'import java.util.*;\nimport java.io.*;\n\npublic class Main {\n    public static void main(String[] args) throws IOException {\n        StreamTokenizer in = new StreamTokenizer(new BufferedReader(new InputStreamReader(System.in)));\n        in.nextToken(); int n = (int) in.nval;\n        in.nextToken(); long target = (long) in.nval;\n        long[] nums = new long[n];\n        for (int k = 0; k < n; k++) {\n            in.nextToken();\n            nums[k] = (long) in.nval;\n        }\n        // TODO: your solution here\n        int i = 0, j = 0;\n        System.out.println(i + " " + j);\n    }\n}\n',
      cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(nullptr);\n    int n;\n    long long target;\n    cin >> n >> target;\n    vector<long long> nums(n);\n    for (int k = 0; k < n; k++) cin >> nums[k];\n    // TODO: your solution here\n    int i = 0, j = 0;\n    cout << i << " " << j << endl;\n    return 0;\n}\n',
      c: '#include <stdio.h>\n#include <stdlib.h>\n\nint main(void) {\n    int n;\n    long long target;\n    if (scanf("%d %lld", &n, &target) != 2) return 0;\n    long long *nums = (long long *) malloc((size_t) n * sizeof(long long));\n    for (int k = 0; k < n; k++) scanf("%lld", &nums[k]);\n    /* TODO: your solution here */\n    int i = 0, j = 0;\n    printf("%d %d\\n", i, j);\n    free(nums);\n    return 0;\n}\n',
      go: 'package main\n\nimport (\n\t"bufio"\n\t"fmt"\n\t"os"\n)\n\nfunc main() {\n\treader := bufio.NewReader(os.Stdin)\n\tvar n int\n\tvar target int64\n\tfmt.Fscan(reader, &n, &target)\n\tnums := make([]int64, n)\n\tfor k := 0; k < n; k++ {\n\t\tfmt.Fscan(reader, &nums[k])\n\t}\n\t// TODO: your solution here\n\ti, j := 0, 0\n\tfmt.Printf("%d %d\\n", i, j)\n}\n',
      rust: 'use std::io::{self, Read};\n\nfn main() {\n    let mut input = String::new();\n    io::stdin().read_to_string(&mut input).unwrap();\n    let mut iter = input.split_whitespace();\n    let n: usize = iter.next().unwrap().parse().unwrap();\n    let _target: i64 = iter.next().unwrap().parse().unwrap();\n    let nums: Vec<i64> = (0..n).map(|_| iter.next().unwrap().parse().unwrap()).collect();\n    let _ = nums;\n    // TODO: your solution here\n    let (i, j) = (0usize, 0usize);\n    println!("{} {}", i, j);\n}\n',
    },
    timeLimit: 5000,
    memoryLimit: 256,
    tags: ['array', 'hash-table'],
    testCases: [
      {
        input: '4 9\n2 7 11 15',
        expectedOutput: '0 1',
        description: 'Basic case',
        isHidden: false,
        sortOrder: 0,
      },
      {
        input: '3 6\n3 2 4',
        expectedOutput: '1 2',
        description: 'Non-adjacent elements',
        isHidden: false,
        sortOrder: 1,
      },
      {
        input: '2 6\n3 3',
        expectedOutput: '0 1',
        description: 'Duplicate values',
        isHidden: false,
        sortOrder: 2,
      },
      {
        input: '5 9\n1 5 3 7 2',
        expectedOutput: '1 3',
        description: 'Larger array',
        isHidden: true,
        sortOrder: 3,
      },
      {
        input: '5 -8\n-1 -2 -3 -4 -5',
        expectedOutput: '2 4',
        description: 'Negative numbers',
        isHidden: true,
        sortOrder: 4,
      },
    ],
  },
  {
    title: 'Valid Parentheses',
    description: [
      "Given a string s containing only the characters '(', ')', '{', '}', '[' and ']', determine if the input is valid.",
      '',
      'A string is valid when:',
      '1. Each open bracket is closed by the same type of bracket.',
      '2. Open brackets are closed in the correct order.',
      '3. Every close bracket has a matching open bracket of the same type.',
      '',
      '## Input Format',
      'A single line containing the string s (may be empty).',
      '',
      '## Output Format',
      'Print YES if the string is valid, otherwise NO.',
      '',
      '## Constraints',
      '- 0 <= |s| <= 10^4',
      '- s consists of bracket characters only.',
      '',
      '## Example',
      'Input:',
      '```',
      '()[]{}',
      '```',
      'Output:',
      '```',
      'YES',
      '```',
    ].join('\n'),
    difficulty: 'easy',
    company: 'Amazon',
    constraints: '0 <= |s| <= 10^4\ns consists only of the characters (, ), {, }, [ and ].',
    examples: [
      { input: '()', output: 'YES' },
      { input: '()[]{}', output: 'YES' },
      { input: '(]', output: 'NO' },
    ],
    starterCode: {
      python:
        "import sys\n\ndef solve(s):\n    # TODO: your solution here\n    return False\n\ndef main():\n    s = sys.stdin.readline().rstrip('\\n')\n    print('YES' if solve(s) else 'NO')\n\nif __name__ == '__main__':\n    main()\n",
      javascript:
        "const s = require('fs').readFileSync(0, 'utf-8').split('\\n')[0] ?? '';\n\nfunction solve(s) {\n  // TODO: your solution here\n  return false;\n}\n\nconsole.log(solve(s) ? 'YES' : 'NO');\n",
      typescript:
        "const s: string = require('fs').readFileSync(0, 'utf-8').split('\\n')[0] ?? '';\n\nfunction solve(s: string): boolean {\n  // TODO: your solution here\n  return false;\n}\n\nconsole.log(solve(s) ? 'YES' : 'NO');\n",
      java: 'import java.util.*;\nimport java.io.*;\n\npublic class Main {\n    public static void main(String[] args) throws IOException {\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n        String s = br.readLine();\n        if (s == null) s = "";\n        // TODO: your solution here\n        boolean ok = false;\n        System.out.println(ok ? "YES" : "NO");\n    }\n}\n',
      cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(nullptr);\n    string s;\n    getline(cin, s);\n    // TODO: your solution here\n    bool ok = false;\n    cout << (ok ? "YES" : "NO") << endl;\n    return 0;\n}\n',
      c: '#include <stdio.h>\n#include <string.h>\n\nint main(void) {\n    char s[10005];\n    if (!fgets(s, sizeof(s), stdin)) s[0] = \'\\0\';\n    size_t len = strlen(s);\n    if (len > 0 && s[len - 1] == \'\\n\') s[len - 1] = \'\\0\';\n    /* TODO: your solution here */\n    int ok = 0;\n    printf("%s\\n", ok ? "YES" : "NO");\n    return 0;\n}\n',
      go: 'package main\n\nimport (\n\t"bufio"\n\t"fmt"\n\t"os"\n)\n\nfunc main() {\n\treader := bufio.NewReader(os.Stdin)\n\ts, _ := reader.ReadString(\'\\n\')\n\tif len(s) > 0 && s[len(s)-1] == \'\\n\' {\n\t\ts = s[:len(s)-1]\n\t}\n\t// TODO: your solution here\n\tok := false\n\tif ok {\n\t\tfmt.Println("YES")\n\t} else {\n\t\tfmt.Println("NO")\n\t}\n\t_ = s\n}\n',
      rust: 'use std::io::{self, BufRead};\n\nfn main() {\n    let stdin = io::stdin();\n    let mut s = String::new();\n    stdin.lock().read_line(&mut s).unwrap();\n    let s = s.trim_end_matches(\'\\n\').trim_end_matches(\'\\r\').to_string();\n    let _ = s;\n    // TODO: your solution here\n    let ok = false;\n    println!("{}", if ok { "YES" } else { "NO" });\n}\n',
    },
    timeLimit: 5000,
    memoryLimit: 256,
    tags: ['string', 'stack'],
    testCases: [
      {
        input: '()',
        expectedOutput: 'YES',
        description: 'Simple pair',
        isHidden: false,
        sortOrder: 0,
      },
      {
        input: '()[]{}',
        expectedOutput: 'YES',
        description: 'Multiple types',
        isHidden: false,
        sortOrder: 1,
      },
      {
        input: '(]',
        expectedOutput: 'NO',
        description: 'Mismatched',
        isHidden: false,
        sortOrder: 2,
      },
      {
        input: '([)]',
        expectedOutput: 'NO',
        description: 'Wrong nesting order',
        isHidden: true,
        sortOrder: 3,
      },
      {
        input: '{[]}',
        expectedOutput: 'YES',
        description: 'Nested valid',
        isHidden: true,
        sortOrder: 4,
      },
      {
        input: '',
        expectedOutput: 'YES',
        description: 'Empty string',
        isHidden: true,
        sortOrder: 5,
      },
    ],
  },
  {
    title: 'Reverse Linked List',
    description: [
      'Given a singly linked list of N integers, reverse the list and print the values in reversed order.',
      '',
      '## Input Format',
      'The first line contains a single integer N (the number of nodes).',
      'The second line contains N space-separated integers, the list values in order from head to tail.',
      'If N is 0 the second line is empty.',
      '',
      '## Output Format',
      'Print N space-separated integers: the reversed list values. If N is 0, print an empty line.',
      '',
      '## Constraints',
      '- 0 <= N <= 5000',
      '- -5000 <= value <= 5000',
      '',
      '## Example',
      'Input:',
      '```',
      '5',
      '1 2 3 4 5',
      '```',
      'Output:',
      '```',
      '5 4 3 2 1',
      '```',
    ].join('\n'),
    difficulty: 'easy',
    company: 'Microsoft',
    constraints: '0 <= N <= 5000\n-5000 <= value <= 5000',
    examples: [
      { input: '5\n1 2 3 4 5', output: '5 4 3 2 1' },
      { input: '2\n1 2', output: '2 1' },
      { input: '0\n', output: '' },
    ],
    starterCode: {
      python:
        "import sys\n\ndef solve(values):\n    # TODO: your solution here\n    return values\n\ndef main():\n    data = sys.stdin.read().split()\n    n = int(data[0]) if data else 0\n    values = [int(x) for x in data[1:1 + n]]\n    result = solve(values)\n    print(' '.join(str(x) for x in result))\n\nif __name__ == '__main__':\n    main()\n",
      javascript:
        "const tokens = require('fs').readFileSync(0, 'utf-8').trim().split(/\\s+/).filter(Boolean);\nconst n = tokens.length === 0 ? 0 : Number(tokens[0]);\nconst values = tokens.slice(1, 1 + n).map(Number);\n\nfunction solve(values) {\n  // TODO: your solution here\n  return values;\n}\n\nconsole.log(solve(values).join(' '));\n",
      typescript:
        "const tokens = require('fs').readFileSync(0, 'utf-8').trim().split(/\\s+/).filter(Boolean) as string[];\nconst n: number = tokens.length === 0 ? 0 : Number(tokens[0]);\nconst values: number[] = tokens.slice(1, 1 + n).map(Number);\n\nfunction solve(values: number[]): number[] {\n  // TODO: your solution here\n  return values;\n}\n\nconsole.log(solve(values).join(' '));\n",
      java: "import java.util.*;\nimport java.io.*;\n\npublic class Main {\n    public static void main(String[] args) throws IOException {\n        StreamTokenizer in = new StreamTokenizer(new BufferedReader(new InputStreamReader(System.in)));\n        int tok = in.nextToken();\n        int n = tok == StreamTokenizer.TT_EOF ? 0 : (int) in.nval;\n        int[] values = new int[n];\n        for (int k = 0; k < n; k++) {\n            in.nextToken();\n            values[k] = (int) in.nval;\n        }\n        // TODO: your solution here\n        int[] result = values;\n        StringBuilder sb = new StringBuilder();\n        for (int k = 0; k < result.length; k++) {\n            if (k > 0) sb.append(' ');\n            sb.append(result[k]);\n        }\n        System.out.println(sb.toString());\n    }\n}\n",
      cpp: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(nullptr);\n    int n = 0;\n    if (!(cin >> n)) n = 0;\n    vector<int> values(n);\n    for (int k = 0; k < n; k++) cin >> values[k];\n    // TODO: your solution here\n    vector<int> result = values;\n    for (int k = 0; k < (int) result.size(); k++) {\n        if (k > 0) cout << ' ';\n        cout << result[k];\n    }\n    cout << endl;\n    return 0;\n}\n",
      c: '#include <stdio.h>\n#include <stdlib.h>\n\nint main(void) {\n    int n = 0;\n    if (scanf("%d", &n) != 1) n = 0;\n    int *values = n > 0 ? (int *) malloc((size_t) n * sizeof(int)) : NULL;\n    for (int k = 0; k < n; k++) scanf("%d", &values[k]);\n    /* TODO: your solution here */\n    int *result = values;\n    for (int k = 0; k < n; k++) {\n        if (k > 0) printf(" ");\n        printf("%d", result[k]);\n    }\n    printf("\\n");\n    free(values);\n    return 0;\n}\n',
      go: 'package main\n\nimport (\n\t"bufio"\n\t"fmt"\n\t"os"\n\t"strconv"\n\t"strings"\n)\n\nfunc main() {\n\treader := bufio.NewReader(os.Stdin)\n\tvar n int\n\tif _, err := fmt.Fscan(reader, &n); err != nil {\n\t\tn = 0\n\t}\n\tvalues := make([]int, n)\n\tfor k := 0; k < n; k++ {\n\t\tfmt.Fscan(reader, &values[k])\n\t}\n\t// TODO: your solution here\n\tresult := values\n\tparts := make([]string, len(result))\n\tfor k, v := range result {\n\t\tparts[k] = strconv.Itoa(v)\n\t}\n\tfmt.Println(strings.Join(parts, " "))\n}\n',
      rust: 'use std::io::{self, Read};\n\nfn main() {\n    let mut input = String::new();\n    io::stdin().read_to_string(&mut input).unwrap();\n    let mut iter = input.split_whitespace();\n    let n: usize = iter.next().and_then(|s| s.parse().ok()).unwrap_or(0);\n    let values: Vec<i32> = (0..n).map(|_| iter.next().unwrap().parse().unwrap()).collect();\n    // TODO: your solution here\n    let result = values;\n    let parts: Vec<String> = result.iter().map(|v| v.to_string()).collect();\n    println!("{}", parts.join(" "));\n}\n',
    },
    timeLimit: 5000,
    memoryLimit: 256,
    tags: ['linked-list', 'recursion'],
    testCases: [
      {
        input: '5\n1 2 3 4 5',
        expectedOutput: '5 4 3 2 1',
        description: 'Standard case',
        isHidden: false,
        sortOrder: 0,
      },
      {
        input: '2\n1 2',
        expectedOutput: '2 1',
        description: 'Two elements',
        isHidden: false,
        sortOrder: 1,
      },
      {
        input: '0\n',
        expectedOutput: '',
        description: 'Empty list',
        isHidden: false,
        sortOrder: 2,
      },
      {
        input: '1\n1',
        expectedOutput: '1',
        description: 'Single element',
        isHidden: true,
        sortOrder: 3,
      },
    ],
  },

  // ---- Medium -------------------------------------------------------------
  {
    title: 'Longest Substring Without Repeating Characters',
    description: [
      'Given a string s, find the length of the longest substring that contains no repeated characters.',
      '',
      '## Input Format',
      'A single line containing the string s (may be empty).',
      '',
      '## Output Format',
      'Print a single integer: the length of the longest substring with no repeated characters.',
      '',
      '## Constraints',
      '- 0 <= |s| <= 5 * 10^4',
      '- s consists of English letters, digits, symbols, and spaces.',
      '',
      '## Example',
      'Input:',
      '```',
      'abcabcbb',
      '```',
      'Output:',
      '```',
      '3',
      '```',
    ].join('\n'),
    difficulty: 'medium',
    company: 'Amazon',
    constraints:
      '0 <= |s| <= 5 * 10^4\ns consists of English letters, digits, symbols, and spaces.',
    examples: [
      { input: 'abcabcbb', output: '3', explanation: 'The answer is "abc".' },
      { input: 'bbbbb', output: '1', explanation: 'The answer is "b".' },
      { input: 'pwwkew', output: '3', explanation: 'The answer is "wke".' },
    ],
    starterCode: {
      python:
        "import sys\n\ndef solve(s):\n    # TODO: your solution here\n    return 0\n\ndef main():\n    s = sys.stdin.readline().rstrip('\\n')\n    print(solve(s))\n\nif __name__ == '__main__':\n    main()\n",
      javascript:
        "const s = require('fs').readFileSync(0, 'utf-8').split('\\n')[0] ?? '';\n\nfunction solve(s) {\n  // TODO: your solution here\n  return 0;\n}\n\nconsole.log(solve(s));\n",
      typescript:
        "const s: string = require('fs').readFileSync(0, 'utf-8').split('\\n')[0] ?? '';\n\nfunction solve(s: string): number {\n  // TODO: your solution here\n  return 0;\n}\n\nconsole.log(solve(s));\n",
      java: 'import java.io.*;\n\npublic class Main {\n    public static void main(String[] args) throws IOException {\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n        String s = br.readLine();\n        if (s == null) s = "";\n        // TODO: your solution here\n        int result = 0;\n        System.out.println(result);\n    }\n}\n',
      cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(nullptr);\n    string s;\n    getline(cin, s);\n    // TODO: your solution here\n    int result = 0;\n    cout << result << endl;\n    return 0;\n}\n',
      c: "#include <stdio.h>\n#include <string.h>\n\nint main(void) {\n    char s[50005];\n    if (!fgets(s, sizeof(s), stdin)) s[0] = '\\0';\n    size_t len = strlen(s);\n    if (len > 0 && s[len - 1] == '\\n') s[len - 1] = '\\0';\n    /* TODO: your solution here */\n    int result = 0;\n    printf(\"%d\\n\", result);\n    return 0;\n}\n",
      go: 'package main\n\nimport (\n\t"bufio"\n\t"fmt"\n\t"os"\n)\n\nfunc main() {\n\treader := bufio.NewReader(os.Stdin)\n\ts, _ := reader.ReadString(\'\\n\')\n\tif len(s) > 0 && s[len(s)-1] == \'\\n\' {\n\t\ts = s[:len(s)-1]\n\t}\n\t_ = s\n\t// TODO: your solution here\n\tresult := 0\n\tfmt.Println(result)\n}\n',
      rust: "use std::io::{self, BufRead};\n\nfn main() {\n    let stdin = io::stdin();\n    let mut s = String::new();\n    stdin.lock().read_line(&mut s).unwrap();\n    let s = s.trim_end_matches('\\n').trim_end_matches('\\r').to_string();\n    let _ = s;\n    // TODO: your solution here\n    let result: usize = 0;\n    println!(\"{}\", result);\n}\n",
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
      {
        input: '',
        expectedOutput: '0',
        description: 'Empty string',
        isHidden: true,
        sortOrder: 3,
      },
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
    description: [
      'Given a binary tree, print its level-order traversal (left to right, one level per line).',
      '',
      '## Input Format',
      'A single line with whitespace-separated tokens describing the tree in level order.',
      "Each token is either an integer (a node value) or '#' for a missing child.",
      'An empty input represents an empty tree.',
      '',
      '## Output Format',
      'For each level from top to bottom, print the values on that level on a single line, separated by spaces.',
      'Print nothing for an empty tree.',
      '',
      '## Constraints',
      '- 0 <= number of nodes <= 2000',
      '- -1000 <= node value <= 1000',
      '',
      '## Example',
      'Input:',
      '```',
      '3 9 20 # # 15 7',
      '```',
      'Output:',
      '```',
      '3',
      '9 20',
      '15 7',
      '```',
    ].join('\n'),
    difficulty: 'medium',
    company: 'Meta',
    constraints:
      '0 <= number of nodes <= 2000\n-1000 <= node value <= 1000\nMissing children are represented by #.',
    examples: [
      { input: '3 9 20 # # 15 7', output: '3\n9 20\n15 7' },
      { input: '1', output: '1' },
      { input: '', output: '' },
    ],
    starterCode: {
      python:
        "import sys\n\ndef solve(tokens):\n    # TODO: your solution here\n    # Return a list of levels; each level is a list of ints.\n    return []\n\ndef main():\n    tokens = sys.stdin.read().split()\n    levels = solve(tokens)\n    print('\\n'.join(' '.join(str(v) for v in lvl) for lvl in levels))\n\nif __name__ == '__main__':\n    main()\n",
      javascript:
        "const tokens = require('fs').readFileSync(0, 'utf-8').trim().split(/\\s+/).filter(Boolean);\n\nfunction solve(tokens) {\n  // TODO: your solution here\n  // Return an array of levels; each level is an array of numbers.\n  return [];\n}\n\nconst levels = solve(tokens);\nconsole.log(levels.map((lvl) => lvl.join(' ')).join('\\n'));\n",
      typescript:
        "const tokens = require('fs').readFileSync(0, 'utf-8').trim().split(/\\s+/).filter(Boolean) as string[];\n\nfunction solve(tokens: string[]): number[][] {\n  // TODO: your solution here\n  return [];\n}\n\nconst levels = solve(tokens);\nconsole.log(levels.map((lvl) => lvl.join(' ')).join('\\n'));\n",
      java: "import java.util.*;\nimport java.io.*;\n\npublic class Main {\n    public static void main(String[] args) throws IOException {\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n        StringBuilder all = new StringBuilder();\n        String line;\n        while ((line = br.readLine()) != null) all.append(line).append(' ');\n        String[] tokens = all.toString().trim().isEmpty() ? new String[0] : all.toString().trim().split(\"\\\\s+\");\n        // TODO: your solution here\n        List<List<Integer>> levels = new ArrayList<>();\n        StringBuilder out = new StringBuilder();\n        for (int l = 0; l < levels.size(); l++) {\n            if (l > 0) out.append('\\n');\n            List<Integer> lvl = levels.get(l);\n            for (int k = 0; k < lvl.size(); k++) {\n                if (k > 0) out.append(' ');\n                out.append(lvl.get(k));\n            }\n        }\n        System.out.println(out.toString());\n    }\n}\n",
      cpp: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(nullptr);\n    vector<string> tokens;\n    string tok;\n    while (cin >> tok) tokens.push_back(tok);\n    // TODO: your solution here\n    vector<vector<int>> levels;\n    for (size_t l = 0; l < levels.size(); l++) {\n        if (l > 0) cout << '\\n';\n        for (size_t k = 0; k < levels[l].size(); k++) {\n            if (k > 0) cout << ' ';\n            cout << levels[l][k];\n        }\n    }\n    cout << endl;\n    return 0;\n}\n",
      c: '#include <stdio.h>\n#include <string.h>\n#include <stdlib.h>\n\nint main(void) {\n    char **tokens = NULL;\n    size_t count = 0, cap = 0;\n    char buf[64];\n    while (scanf("%63s", buf) == 1) {\n        if (count == cap) {\n            cap = cap ? cap * 2 : 16;\n            tokens = (char **) realloc(tokens, cap * sizeof(char *));\n        }\n        tokens[count++] = strdup(buf);\n    }\n    /* TODO: your solution here */\n    /* Build the tree from tokens, then print each level on its own line. */\n    (void) tokens;\n    (void) count;\n    printf("\\n");\n    return 0;\n}\n',
      go: 'package main\n\nimport (\n\t"bufio"\n\t"fmt"\n\t"os"\n\t"strconv"\n\t"strings"\n)\n\nfunc main() {\n\tscanner := bufio.NewScanner(os.Stdin)\n\tscanner.Buffer(make([]byte, 1024*1024), 1024*1024)\n\tscanner.Split(bufio.ScanWords)\n\tvar tokens []string\n\tfor scanner.Scan() {\n\t\ttokens = append(tokens, scanner.Text())\n\t}\n\t_ = tokens\n\t// TODO: your solution here\n\tvar levels [][]int\n\tlines := make([]string, 0, len(levels))\n\tfor _, lvl := range levels {\n\t\tparts := make([]string, len(lvl))\n\t\tfor k, v := range lvl {\n\t\t\tparts[k] = strconv.Itoa(v)\n\t\t}\n\t\tlines = append(lines, strings.Join(parts, " "))\n\t}\n\tfmt.Println(strings.Join(lines, "\\n"))\n}\n',
      rust: 'use std::io::{self, Read};\n\nfn main() {\n    let mut input = String::new();\n    io::stdin().read_to_string(&mut input).unwrap();\n    let tokens: Vec<&str> = input.split_whitespace().collect();\n    let _ = tokens;\n    // TODO: your solution here\n    let levels: Vec<Vec<i32>> = Vec::new();\n    let lines: Vec<String> = levels\n        .iter()\n        .map(|lvl| lvl.iter().map(|v| v.to_string()).collect::<Vec<_>>().join(" "))\n        .collect();\n    println!("{}", lines.join("\\n"));\n}\n',
    },
    timeLimit: 5000,
    memoryLimit: 256,
    tags: ['tree', 'queue'],
    testCases: [
      {
        input: '3 9 20 # # 15 7',
        expectedOutput: '3\n9 20\n15 7',
        description: 'Standard tree',
        isHidden: false,
        sortOrder: 0,
      },
      {
        input: '1',
        expectedOutput: '1',
        description: 'Single node',
        isHidden: false,
        sortOrder: 1,
      },
      {
        input: '',
        expectedOutput: '',
        description: 'Empty tree',
        isHidden: false,
        sortOrder: 2,
      },
      {
        input: '1 2 3 4 5',
        expectedOutput: '1\n2 3\n4 5',
        description: 'Complete tree',
        isHidden: true,
        sortOrder: 3,
      },
    ],
  },
  {
    title: 'Coin Change',
    description: [
      'You are given N coin denominations and a target amount. Return the minimum number of coins needed to make up exactly that amount. If it is impossible, return -1. You may use each denomination any number of times.',
      '',
      '## Input Format',
      'The first line contains two integers N and target.',
      'The second line contains N space-separated integers, the coin denominations.',
      '',
      '## Output Format',
      'Print a single integer: the minimum number of coins, or -1 if the amount cannot be made.',
      '',
      '## Constraints',
      '- 1 <= N <= 12',
      '- 1 <= denomination <= 2^31 - 1',
      '- 0 <= target <= 10^4',
      '',
      '## Example',
      'Input:',
      '```',
      '3 12',
      '1 5 10',
      '```',
      'Output:',
      '```',
      '3',
      '```',
    ].join('\n'),
    difficulty: 'medium',
    company: 'Google',
    constraints: '1 <= N <= 12\n1 <= denomination <= 2^31 - 1\n0 <= target <= 10^4',
    examples: [
      { input: '3 12\n1 5 10', output: '3', explanation: '12 = 10 + 1 + 1.' },
      { input: '1 3\n2', output: '-1' },
      { input: '1 0\n1', output: '0' },
    ],
    starterCode: {
      python:
        "import sys\n\ndef solve(coins, amount):\n    # TODO: your solution here\n    return -1\n\ndef main():\n    data = sys.stdin.read().split()\n    n = int(data[0])\n    amount = int(data[1])\n    coins = [int(x) for x in data[2:2 + n]]\n    print(solve(coins, amount))\n\nif __name__ == '__main__':\n    main()\n",
      javascript:
        "const tokens = require('fs').readFileSync(0, 'utf-8').trim().split(/\\s+/);\nconst n = Number(tokens[0]);\nconst amount = Number(tokens[1]);\nconst coins = tokens.slice(2, 2 + n).map(Number);\n\nfunction solve(coins, amount) {\n  // TODO: your solution here\n  return -1;\n}\n\nconsole.log(solve(coins, amount));\n",
      typescript:
        "const tokens = require('fs').readFileSync(0, 'utf-8').trim().split(/\\s+/) as string[];\nconst n = Number(tokens[0]);\nconst amount = Number(tokens[1]);\nconst coins: number[] = tokens.slice(2, 2 + n).map(Number);\n\nfunction solve(coins: number[], amount: number): number {\n  // TODO: your solution here\n  return -1;\n}\n\nconsole.log(solve(coins, amount));\n",
      java: 'import java.util.*;\nimport java.io.*;\n\npublic class Main {\n    public static void main(String[] args) throws IOException {\n        StreamTokenizer in = new StreamTokenizer(new BufferedReader(new InputStreamReader(System.in)));\n        in.nextToken(); int n = (int) in.nval;\n        in.nextToken(); int amount = (int) in.nval;\n        long[] coins = new long[n];\n        for (int k = 0; k < n; k++) {\n            in.nextToken();\n            coins[k] = (long) in.nval;\n        }\n        // TODO: your solution here\n        int result = -1;\n        System.out.println(result);\n    }\n}\n',
      cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(nullptr);\n    int n, amount;\n    cin >> n >> amount;\n    vector<long long> coins(n);\n    for (int k = 0; k < n; k++) cin >> coins[k];\n    // TODO: your solution here\n    int result = -1;\n    cout << result << endl;\n    return 0;\n}\n',
      c: '#include <stdio.h>\n#include <stdlib.h>\n\nint main(void) {\n    int n, amount;\n    if (scanf("%d %d", &n, &amount) != 2) return 0;\n    long long *coins = (long long *) malloc((size_t) n * sizeof(long long));\n    for (int k = 0; k < n; k++) scanf("%lld", &coins[k]);\n    /* TODO: your solution here */\n    int result = -1;\n    printf("%d\\n", result);\n    free(coins);\n    return 0;\n}\n',
      go: 'package main\n\nimport (\n\t"bufio"\n\t"fmt"\n\t"os"\n)\n\nfunc main() {\n\treader := bufio.NewReader(os.Stdin)\n\tvar n, amount int\n\tfmt.Fscan(reader, &n, &amount)\n\tcoins := make([]int64, n)\n\tfor k := 0; k < n; k++ {\n\t\tfmt.Fscan(reader, &coins[k])\n\t}\n\t_ = coins\n\t_ = amount\n\t// TODO: your solution here\n\tresult := -1\n\tfmt.Println(result)\n}\n',
      rust: 'use std::io::{self, Read};\n\nfn main() {\n    let mut input = String::new();\n    io::stdin().read_to_string(&mut input).unwrap();\n    let mut iter = input.split_whitespace();\n    let n: usize = iter.next().unwrap().parse().unwrap();\n    let amount: i64 = iter.next().unwrap().parse().unwrap();\n    let coins: Vec<i64> = (0..n).map(|_| iter.next().unwrap().parse().unwrap()).collect();\n    let _ = (coins, amount);\n    // TODO: your solution here\n    let result: i64 = -1;\n    println!("{}", result);\n}\n',
    },
    timeLimit: 5000,
    memoryLimit: 256,
    tags: ['array', 'dynamic-programming'],
    testCases: [
      {
        input: '3 12\n1 5 10',
        expectedOutput: '3',
        description: 'Greedy-safe case',
        isHidden: false,
        sortOrder: 0,
      },
      {
        input: '1 3\n2',
        expectedOutput: '-1',
        description: 'Impossible',
        isHidden: false,
        sortOrder: 1,
      },
      {
        input: '1 0\n1',
        expectedOutput: '0',
        description: 'Zero amount',
        isHidden: false,
        sortOrder: 2,
      },
      {
        input: '3 6\n1 3 4',
        expectedOutput: '2',
        description: 'Greedy fails (3+3)',
        isHidden: true,
        sortOrder: 3,
      },
      {
        input: '4 27\n2 5 10 1',
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
      { input: '[[1,4,5],[1,3,4],[2,6]]', output: '[1,1,2,3,4,4,5,6]' },
      { input: '[]', output: '[]' },
      { input: '[[]]', output: '[]' },
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
      { input: '[0,1,0,2,1,0,1,3,2,1,2,1]', output: '6' },
      { input: '[4,2,0,3,2,5]', output: '9' },
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
        .values(
          p.testCases.map((tc) => ({
            ...tc,
            problemId: inserted.id,
            timeoutMs: p.timeLimit,
            memoryMb: p.memoryLimit,
          })),
        )
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
