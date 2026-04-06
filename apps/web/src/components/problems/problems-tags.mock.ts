import type { TagInfo } from '@syncode/contracts';
import { MOCK_PROBLEM_SUMMARIES } from './problems-list.mock';

export type ProblemTagInfo = TagInfo;

export interface ProblemsTagsResponse {
  data: ProblemTagInfo[];
}

const PROBLEM_TAG_CATALOG: { slug: string; name: string }[] = [
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
];

const problemTagNameBySlug = new Map(PROBLEM_TAG_CATALOG.map((tag) => [tag.slug, tag.name]));

export const MOCK_PROBLEM_TAGS_RESPONSE: ProblemsTagsResponse = {
  data: PROBLEM_TAG_CATALOG.map((tag) => ({
    ...tag,
    count: MOCK_PROBLEM_SUMMARIES.filter((problem) => problem.tags.includes(tag.slug)).length,
  }))
    .filter((tag) => tag.count > 0)
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name)),
};

export function getProblemTagName(slug: string) {
  return problemTagNameBySlug.get(slug) ?? slug;
}
