import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Avatar } from '../../components/ui/Avatar.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { ProgressRing } from '../../components/ui/ProgressRing.tsx';
import { Select } from '../../components/ui/Select.tsx';
import { problems } from '../../data/problems.ts';
import { sessions } from '../../data/sessions.ts';
import { users } from '../../data/users.ts';

type Difficulty = 'all' | 'easy' | 'medium' | 'hard';
type RoleFilter = 'all' | 'candidate' | 'interviewer';

const getProblem = (id: string) => problems.find((p) => p.id === id);
const getUser = (id: string) => users.find((u) => u.id === id);

function formatDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const difficultyPills: { value: Difficulty; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

export function SessionHistory() {
  const [difficulty, setDifficulty] = useState<Difficulty>('all');
  const [role, setRole] = useState<RoleFilter>('all');

  const filtered = sessions.filter((s) => {
    if (role !== 'all' && s.role !== role) return false;
    if (difficulty !== 'all') {
      const problem = getProblem(s.problemId);
      if (problem?.difficulty !== difficulty) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Session History</h1>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3 items-center">
        {difficultyPills.map((pill) => (
          <button
            key={pill.value}
            type="button"
            onClick={() => setDifficulty(pill.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer ${
              difficulty === pill.value
                ? 'gradient-brand text-white'
                : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {pill.label}
          </button>
        ))}

        <Select
          value={role}
          onChange={(e) => setRole(e.target.value as RoleFilter)}
          className="w-40"
        >
          <option value="all">All Roles</option>
          <option value="candidate">Candidate</option>
          <option value="interviewer">Interviewer</option>
        </Select>
      </div>

      {/* Session Card List */}
      <div className="space-y-3">
        {filtered.map((session) => {
          const problem = getProblem(session.problemId);
          const partner = getUser(session.partnerId);

          return (
            <Link key={session.id} to={`/dashboard/history/${session.id}`} className="block">
              <Card className="flex items-center justify-between hover:border-[var(--primary)]/40 transition-colors">
                {/* Left side */}
                <div className="min-w-0">
                  <p className="font-medium text-[var(--text-primary)]">
                    {problem?.title ?? 'Unknown Problem'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-[var(--text-secondary)]">
                      {formatDate(session.date)}
                    </span>
                    <Badge variant={session.role === 'candidate' ? 'info' : 'neutral'}>
                      {session.role}
                    </Badge>
                    <span className="text-sm text-[var(--text-secondary)]">
                      {session.duration} min
                    </span>
                  </div>
                </div>

                {/* Right side */}
                <div className="flex items-center gap-4 shrink-0">
                  <div className="flex items-center gap-2">
                    <Avatar size="sm" name={partner?.name} />
                    <span className="text-sm text-[var(--text-secondary)]">
                      {partner?.name ?? 'Unknown'}
                    </span>
                  </div>
                  <ProgressRing value={session.scores.overall} size={48} strokeWidth={4} />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Load More */}
      <div className="text-center">
        <Button variant="secondary" onClick={() => toast('No more sessions to load')}>
          Load More
        </Button>
      </div>
    </div>
  );
}
