import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '../../components/ui/Badge.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { Modal } from '../../components/ui/Modal.tsx';

import { problems } from '../../data/problems.ts';

const acceptanceRates: Record<string, number> = {
  p1: 72,
  p2: 85,
  p3: 68,
  p4: 78,
  p5: 55,
  p6: 42,
  p7: 48,
  p8: 38,
  p9: 22,
  p10: 18,
  p11: 25,
  p12: 20,
};

const submissionCounts: Record<string, number> = {
  p1: 4520,
  p2: 3210,
  p3: 2890,
  p4: 2450,
  p5: 1980,
  p6: 1750,
  p7: 1420,
  p8: 1380,
  p9: 890,
  p10: 760,
  p11: 640,
  p12: 520,
};

export function AdminProblems() {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const problemToDelete = problems.find((p) => p.id === deleteTarget);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold">Problem Management</h1>
        <Button variant="primary">
          <Plus size={16} className="mr-2" />
          Add Problem
        </Button>
      </div>

      {/* Data Table */}
      <Card padding="p-0" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--bg-subtle)]">
                <th className="text-xs uppercase text-[var(--text-tertiary)] font-mono font-medium px-4 py-3 text-left">
                  Title
                </th>
                <th className="text-xs uppercase text-[var(--text-tertiary)] font-mono font-medium px-4 py-3 text-left">
                  Difficulty
                </th>
                <th className="text-xs uppercase text-[var(--text-tertiary)] font-mono font-medium px-4 py-3 text-left">
                  Tags
                </th>
                <th className="text-xs uppercase text-[var(--text-tertiary)] font-mono font-medium px-4 py-3 text-left">
                  Submissions
                </th>
                <th className="text-xs uppercase text-[var(--text-tertiary)] font-mono font-medium px-4 py-3 text-left">
                  Acceptance
                </th>
                <th className="text-xs uppercase text-[var(--text-tertiary)] font-mono font-medium px-4 py-3 text-left">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {problems.map((problem) => {
                const rate = acceptanceRates[problem.id] ?? 50;
                const subs = submissionCounts[problem.id] ?? 0;
                return (
                  <tr
                    key={problem.id}
                    className="border-t border-[var(--border-default)] hover:bg-[var(--bg-subtle)]/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-[var(--text-primary)]">
                      {problem.title}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={problem.difficulty}>{problem.difficulty}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {problem.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-block rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-xs text-[var(--text-secondary)]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-secondary)] font-mono">
                      {subs.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${rate}%`,
                              background:
                                rate >= 60
                                  ? 'var(--success)'
                                  : rate >= 35
                                    ? 'var(--accent)'
                                    : 'var(--error)',
                            }}
                          />
                        </div>
                        <span className="text-xs text-[var(--text-tertiary)]">{rate}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="text-[var(--primary)]">
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[var(--error)]"
                          onClick={() => setDeleteTarget(problem.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Are you sure?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => setDeleteTarget(null)}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--text-secondary)]">
          This will permanently delete <strong>{problemToDelete?.title}</strong>. This action cannot
          be undone.
        </p>
      </Modal>
    </div>
  );
}
