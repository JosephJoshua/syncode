import { CalendarDays, CheckCircle2, ChevronRight, Clock, Plus, TrendingUp } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { Line, LineChart, ResponsiveContainer } from 'recharts';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { problems } from '../../data/problems';
import { sessions } from '../../data/sessions';
import { users } from '../../data/users';
import { fadeInUp, staggeredEntrance } from '../../lib/animations';

const stats = [
  { icon: CalendarDays, label: 'Sessions This Week', value: '12' },
  { icon: CheckCircle2, label: 'Problems Solved', value: '47' },
  { icon: TrendingUp, label: 'Avg Score', value: '82%' },
  { icon: Clock, label: 'Practice Time', value: '24h' },
];

const sparklineData = [
  { week: 'W1', sessions: 3 },
  { week: 'W2', sessions: 5 },
  { week: 'W3', sessions: 4 },
  { week: 'W4', sessions: 7 },
  { week: 'W5', sessions: 6 },
  { week: 'W6', sessions: 8 },
  { week: 'W7', sessions: 5 },
  { week: 'W8', sessions: 9 },
];

function getScoreBadgeVariant(score: number) {
  if (score >= 80) return 'success' as const;
  if (score >= 50) return 'warning' as const;
  return 'error' as const;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function lookupProblemTitle(problemId: string) {
  return problems.find((p) => p.id === problemId)?.title ?? 'Unknown';
}

function lookupUser(userId: string) {
  return users.find((u) => u.id === userId);
}

export function Dashboard() {
  const navigate = useNavigate();
  const recentSessions = sessions.slice(0, 5);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <span className="font-mono text-xs tracking-widest uppercase text-[var(--accent)]">
          // dashboard
        </span>
        <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
          Welcome back, Alice
        </h1>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card
            key={stat.label}
            className="relative overflow-hidden group"
            style={staggeredEntrance(i)}
          >
            {/* Subtle dot-grid texture in cards */}
            <div
              className="absolute inset-0 dot-grid pointer-events-none"
              style={{ opacity: 0.04 }}
            />
            <div className="relative">
              <stat.icon size={16} className="text-[var(--accent)]" />
              <p className="mt-2 text-xs text-[var(--text-secondary)] font-medium uppercase tracking-wide">
                {stat.label}
              </p>
              <p className="mt-1 text-2xl font-mono font-semibold text-[var(--accent)]">
                {stat.value}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mt-6 flex gap-3" style={fadeInUp(300)}>
        <Button variant="primary" onClick={() => navigate('/rooms')}>
          <Plus size={16} className="mr-1.5" />
          Create Room
        </Button>
        <Button variant="secondary" onClick={() => navigate('/rooms/join')}>
          Join Room
        </Button>
        <Link
          to="/problems"
          className="inline-flex items-center justify-center rounded-md px-4 h-9 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors duration-100"
        >
          Browse Problems
        </Link>
      </div>

      {/* Recent Sessions */}
      <div className="mt-8" style={fadeInUp(400)}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
            Recent Sessions
          </h2>
          <Link
            to="/dashboard/sessions"
            className="text-xs font-mono text-[var(--accent)] hover:underline"
          >
            view_all
          </Link>
        </div>

        <Card padding="p-0">
          {/* Header */}
          <div className="grid grid-cols-[1fr_1.5fr_1fr_0.7fr_0.7fr_0.7fr_auto] px-4 py-3 border-b border-[var(--border-default)]">
            {['Date', 'Problem', 'Partner', 'Role', 'Score', 'Duration', ''].map((heading) => (
              <span
                key={heading}
                className="text-xs text-[var(--text-tertiary)] font-mono font-medium uppercase"
              >
                {heading}
              </span>
            ))}
          </div>

          {/* Rows */}
          {recentSessions.map((session, idx) => {
            const partner = lookupUser(session.partnerId);
            const isLast = idx === recentSessions.length - 1;

            return (
              <Link
                key={session.id}
                to={`/dashboard/sessions/${session.id}`}
                className={`grid grid-cols-[1fr_1.5fr_1fr_0.7fr_0.7fr_0.7fr_auto] items-center px-4 py-3 hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer ${
                  isLast ? '' : 'border-b border-[var(--border-default)]'
                }`}
              >
                <span className="text-sm font-mono text-[var(--text-secondary)]">
                  {formatDate(session.date)}
                </span>
                <span className="text-sm text-[var(--text-primary)]">
                  {lookupProblemTitle(session.problemId)}
                </span>
                <span className="flex items-center gap-2">
                  <Avatar name={partner?.name} size="xs" />
                  <span className="text-sm">{partner?.name ?? 'Unknown'}</span>
                </span>
                <span>
                  <Badge variant="neutral" className="capitalize">
                    {session.role}
                  </Badge>
                </span>
                <span>
                  <Badge variant={getScoreBadgeVariant(session.scores.overall)}>
                    {session.scores.overall}
                  </Badge>
                </span>
                <span className="text-sm font-mono text-[var(--text-secondary)]">
                  {session.duration}m
                </span>
                <span className="flex items-center justify-center pl-2">
                  <ChevronRight size={14} className="text-[var(--text-tertiary)]" />
                </span>
              </Link>
            );
          })}
        </Card>
      </div>

      {/* Sparkline Chart */}
      <div className="mt-6" style={fadeInUp(500)}>
        <Card>
          <p className="font-display text-sm font-semibold text-[var(--text-primary)] mb-4">
            Sessions Per Week
          </p>
          <ResponsiveContainer width="100%" height={80}>
            <LineChart data={sparklineData}>
              <Line
                type="monotone"
                dataKey="sessions"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
