import { Settings } from 'lucide-react';
import { Link } from 'react-router';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { problems } from '../../data/problems';
import { sessions } from '../../data/sessions';
import { currentUser } from '../../data/users';

const stats = [
  { value: '47', label: 'Sessions' },
  { value: '32', label: 'Problems' },
  { value: '82%', label: 'Avg Score' },
  { value: '24h', label: 'Practice Time' },
];

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatJoinDate(dateStr: string) {
  const date = new Date(dateStr);
  return `Joined ${date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
}

function lookupProblemTitle(problemId: string) {
  return problems.find((p) => p.id === problemId)?.title ?? 'Unknown';
}

function getScoreBadgeVariant(score: number) {
  if (score >= 80) return 'success' as const;
  if (score >= 50) return 'warning' as const;
  return 'error' as const;
}

export function Profile() {
  const recentActivity = sessions.slice(0, 5);

  return (
    <div>
      {/* Header */}
      <p className="font-mono text-xs tracking-widest uppercase text-[var(--accent)]">
        {'// profile'}
      </p>

      <div className="flex flex-col items-center mt-6">
        <Avatar name={currentUser.name} size="xl" />
        <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--text-primary)] mt-3">
          {currentUser.name}
        </h1>
        <p className="font-mono text-sm text-[var(--text-secondary)]">{currentUser.email}</p>
        <p className="font-mono text-xs text-[var(--text-tertiary)]">
          {formatJoinDate(currentUser.joinDate)}
        </p>
        <Link to="/profile/settings" className="mt-3 inline-block">
          <Button variant="secondary" size="sm">
            <Settings size={14} className="mr-1.5" />
            Edit Profile
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <Card key={stat.label} padding="p-4" className="relative overflow-hidden">
            <div
              className="absolute inset-0 dot-grid pointer-events-none"
              style={{ opacity: 0.04 }}
            />
            <div className="relative">
              <p className="font-mono text-2xl font-semibold text-[var(--accent)]">{stat.value}</p>
              <p className="font-mono text-xs text-[var(--text-tertiary)] uppercase mt-1">
                {stat.label}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="mt-8">
        <p className="font-mono text-xs tracking-widest uppercase text-[var(--accent)] mb-4">
          {'// recent_activity'}
        </p>

        <div className="space-y-2">
          {recentActivity.map((session) => (
            <Link
              key={session.id}
              to={`/dashboard/sessions/${session.id}`}
              className="flex items-center justify-between py-2.5 px-3 rounded-md hover:bg-[var(--bg-subtle)] transition-colors"
            >
              <div className="flex items-center gap-4">
                <span className="font-mono text-xs text-[var(--text-tertiary)] min-w-[60px]">
                  {formatDate(session.date)}
                </span>
                <span className="text-sm text-[var(--text-primary)]">
                  {lookupProblemTitle(session.problemId)}
                </span>
              </div>
              <Badge variant={getScoreBadgeVariant(session.scores.overall)}>
                {session.scores.overall}
              </Badge>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
