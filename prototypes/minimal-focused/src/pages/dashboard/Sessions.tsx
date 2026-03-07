import { ChevronDown, ChevronUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { problems } from '../../data/problems';
import { type SessionRecord, sessions } from '../../data/sessions';
import { users } from '../../data/users';

type Difficulty = 'easy' | 'medium' | 'hard';
type SortKey = 'date' | 'problem' | 'partner' | 'role' | 'duration' | 'score';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 10;

function lookupProblem(problemId: string) {
  return problems.find((p) => p.id === problemId);
}

function lookupUser(userId: string) {
  return users.find((u) => u.id === userId);
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function scoreColor(score: number) {
  if (score >= 80) return 'text-[var(--success)]';
  if (score >= 50) return 'text-[var(--warning)]';
  return 'text-[var(--error)]';
}

function getSortValue(session: SessionRecord, key: SortKey): string | number {
  switch (key) {
    case 'date':
      return session.date;
    case 'problem':
      return lookupProblem(session.problemId)?.title ?? '';
    case 'partner':
      return lookupUser(session.partnerId)?.name ?? '';
    case 'role':
      return session.role;
    case 'duration':
      return session.duration;
    case 'score':
      return session.scores.overall;
  }
}

const columns: { key: SortKey; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'problem', label: 'Problem' },
  { key: 'partner', label: 'Partner' },
  { key: 'role', label: 'Role' },
  { key: 'duration', label: 'Duration' },
  { key: 'score', label: 'Score' },
];

export function Sessions() {
  const [difficultyFilter, setDifficultyFilter] = useState<Set<Difficulty>>(new Set());
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);

  function toggleDifficulty(d: Difficulty) {
    setDifficultyFilter((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
    setPage(0);
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const filtered = useMemo(() => {
    let result = [...sessions];

    if (difficultyFilter.size > 0) {
      result = result.filter((s) => {
        const problem = lookupProblem(s.problemId);
        return problem && difficultyFilter.has(problem.difficulty);
      });
    }

    if (roleFilter !== 'all') {
      result = result.filter((s) => s.role === roleFilter);
    }

    result.sort((a, b) => {
      const aVal = getSortValue(a, sortKey);
      const bVal = getSortValue(b, sortKey);
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [difficultyFilter, roleFilter, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const showingFrom = filtered.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const showingTo = Math.min((page + 1) * PAGE_SIZE, filtered.length);

  const difficultyButtons: { label: string; value: Difficulty }[] = [
    { label: 'Easy', value: 'easy' },
    { label: 'Medium', value: 'medium' },
    { label: 'Hard', value: 'hard' },
  ];

  return (
    <div>
      <nav className="font-mono text-xs mb-4">
        <Link to="/dashboard" className="text-[var(--accent)] hover:underline">
          dashboard
        </Link>
        <span className="text-[var(--text-tertiary)]"> / </span>
        <span className="text-[var(--text-tertiary)]">sessions</span>
      </nav>
      <h1 className="font-display text-xl font-bold text-[var(--text-primary)] tracking-tight">
        Session History
      </h1>

      {/* Filter Bar */}
      <div className="flex gap-2 mt-4 flex-wrap items-center">
        {difficultyButtons.map((d) => {
          const active = difficultyFilter.has(d.value);
          return (
            <button
              key={d.value}
              type="button"
              onClick={() => toggleDifficulty(d.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors cursor-pointer ${
                active
                  ? 'bg-[var(--accent-muted)] text-[var(--accent)] border-[var(--accent)]'
                  : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]'
              }`}
            >
              {d.label}
            </button>
          );
        })}
        <div className="w-40">
          <Select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">All Roles</option>
            <option value="interviewer">Interviewer</option>
            <option value="candidate">Candidate</option>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="mt-4">
        <Card padding="p-0">
          {/* Header */}
          <div className="grid grid-cols-[1fr_1.5fr_1fr_0.7fr_0.7fr_0.7fr] px-4 py-3 border-b border-[var(--border-default)]">
            {columns.map((col) => (
              <button
                key={col.key}
                type="button"
                onClick={() => handleSort(col.key)}
                className="flex items-center gap-1 text-xs font-mono text-[var(--text-tertiary)] font-medium uppercase cursor-pointer hover:text-[var(--text-secondary)] transition-colors"
              >
                {col.label}
                {sortKey === col.key &&
                  (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
              </button>
            ))}
          </div>

          {/* Rows */}
          {paginated.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--text-tertiary)]">
              No sessions match the current filters.
            </div>
          ) : (
            paginated.map((session, idx) => {
              const partner = lookupUser(session.partnerId);
              const isLast = idx === paginated.length - 1;

              return (
                <Link
                  key={session.id}
                  to={`/dashboard/sessions/${session.id}`}
                  className={`grid grid-cols-[1fr_1.5fr_1fr_0.7fr_0.7fr_0.7fr] items-center px-4 py-3 hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer ${
                    isLast ? '' : 'border-b border-[var(--border-default)]'
                  }`}
                >
                  <span className="text-sm font-mono text-[var(--text-secondary)]">
                    {formatDate(session.date)}
                  </span>
                  <span className="text-sm text-[var(--text-primary)]">
                    {lookupProblem(session.problemId)?.title ?? 'Unknown'}
                  </span>
                  <span className="text-sm text-[var(--text-secondary)]">
                    {partner?.name ?? 'Unknown'}
                  </span>
                  <span>
                    <Badge variant="neutral" className="capitalize">
                      {session.role}
                    </Badge>
                  </span>
                  <span className="text-sm font-mono text-[var(--text-secondary)]">
                    {session.duration}m
                  </span>
                  <span
                    className={`text-sm font-mono font-medium ${scoreColor(session.scores.overall)}`}
                  >
                    {session.scores.overall}
                  </span>
                </Link>
              );
            })
          )}
        </Card>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm font-mono text-[var(--text-secondary)]">
          {showingFrom}-{showingTo} of {filtered.length}
        </span>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Prev
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
