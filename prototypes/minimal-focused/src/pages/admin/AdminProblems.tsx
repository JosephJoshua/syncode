import { useEffect, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';

const mockProblems = [
  {
    id: 'p1',
    title: 'Two Sum',
    difficulty: 'easy' as const,
    tags: ['array', 'hash-table'],
    submissions: '3,456',
    acceptance: 67,
  },
  {
    id: 'p2',
    title: 'Valid Parentheses',
    difficulty: 'easy' as const,
    tags: ['string', 'stack'],
    submissions: '2,891',
    acceptance: 72,
  },
  {
    id: 'p3',
    title: 'Merge Two Sorted Lists',
    difficulty: 'easy' as const,
    tags: ['linked-list', 'recursion'],
    submissions: '1,987',
    acceptance: 74,
  },
  {
    id: 'p4',
    title: 'Longest Substring Without Repeating Characters',
    difficulty: 'medium' as const,
    tags: ['string', 'sliding-window'],
    submissions: '2,340',
    acceptance: 45,
  },
  {
    id: 'p5',
    title: 'Add Two Numbers',
    difficulty: 'medium' as const,
    tags: ['linked-list', 'math'],
    submissions: '1,567',
    acceptance: 52,
  },
  {
    id: 'p6',
    title: 'LRU Cache',
    difficulty: 'medium' as const,
    tags: ['hash-table', 'design'],
    submissions: '1,234',
    acceptance: 41,
  },
  {
    id: 'p7',
    title: 'Binary Tree Level Order Traversal',
    difficulty: 'medium' as const,
    tags: ['tree', 'bfs'],
    submissions: '987',
    acceptance: 63,
  },
  {
    id: 'p8',
    title: 'Course Schedule',
    difficulty: 'medium' as const,
    tags: ['graph', 'topological-sort'],
    submissions: '876',
    acceptance: 48,
  },
  {
    id: 'p9',
    title: 'Merge K Sorted Lists',
    difficulty: 'hard' as const,
    tags: ['linked-list', 'heap'],
    submissions: '654',
    acceptance: 34,
  },
  {
    id: 'p10',
    title: 'Trapping Rain Water',
    difficulty: 'hard' as const,
    tags: ['array', 'two-pointers'],
    submissions: '543',
    acceptance: 28,
  },
  {
    id: 'p11',
    title: 'Word Ladder',
    difficulty: 'hard' as const,
    tags: ['bfs', 'string'],
    submissions: '432',
    acceptance: 31,
  },
  {
    id: 'p12',
    title: 'Serialize and Deserialize Binary Tree',
    difficulty: 'hard' as const,
    tags: ['tree', 'design'],
    submissions: '321',
    acceptance: 36,
  },
];

export function AdminProblems() {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <span className="font-mono text-xs tracking-widest uppercase text-[var(--accent)]">
            // problem_management
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
            Problems
          </h1>
        </div>
        <Button variant="primary" size="sm">
          Add Problem
        </Button>
      </div>

      {/* Table */}
      <Card padding="p-0" className="mt-4 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-default)]">
              {['Title', 'Difficulty', 'Tags', 'Submissions', 'Acceptance', 'Actions'].map(
                (heading) => (
                  <th
                    key={heading}
                    className="text-left font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider px-4 py-3"
                  >
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {mockProblems.map((problem, idx) => (
              <tr
                key={problem.id}
                className={
                  idx < mockProblems.length - 1 ? 'border-b border-[var(--border-default)]' : ''
                }
              >
                <td className="px-4 py-3 text-sm text-[var(--text-primary)]">{problem.title}</td>
                <td className="px-4 py-3">
                  <Badge variant={problem.difficulty}>{problem.difficulty}</Badge>
                </td>
                <td className="px-4 py-3 font-mono text-[10px] text-[var(--text-tertiary)]">
                  {problem.tags.join(', ')}
                </td>
                <td className="px-4 py-3 font-mono text-sm">{problem.submissions}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-sm text-[var(--text-secondary)]">
                      {problem.acceptance}%
                    </span>
                    <span className="h-1 w-12 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                      <span
                        className="block h-full rounded-full bg-[var(--accent)]"
                        style={{
                          width: mounted ? `${problem.acceptance}%` : '0%',
                          transition: 'width 800ms cubic-bezier(0.16, 1, 0.3, 1)',
                          transitionDelay: '200ms',
                        }}
                      />
                    </span>
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-3">
                    <button
                      type="button"
                      className="text-xs text-[var(--accent)] hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-xs text-[var(--text-secondary)] hover:text-[var(--error)] cursor-pointer"
                      onClick={() => setDeleteTarget(problem.id)}
                    >
                      Delete
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Are you sure?"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="!bg-[var(--error)] !text-white !hover:bg-red-600"
              onClick={() => setDeleteTarget(null)}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--text-secondary)]">
          This action cannot be undone. The problem and all associated data will be permanently
          removed.
        </p>
      </Modal>
    </div>
  );
}
