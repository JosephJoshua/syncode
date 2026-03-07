import { Plus, TrendingUp } from 'lucide-react';
import { Link } from 'react-router';
import { Bar, BarChart, ResponsiveContainer, XAxis } from 'recharts';
import { Avatar } from '../../components/ui/Avatar.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { ProgressRing } from '../../components/ui/ProgressRing.tsx';
import { problems } from '../../data/problems.ts';
import { sessions } from '../../data/sessions.ts';
import { currentUser, users } from '../../data/users.ts';

const getProblem = (id: string) => problems.find((p) => p.id === id);
const getUser = (id: string) => users.find((u) => u.id === id);

const activityData = [
  { day: 'Mon', sessions: 2 },
  { day: 'Tue', sessions: 3 },
  { day: 'Wed', sessions: 1 },
  { day: 'Thu', sessions: 4 },
  { day: 'Fri', sessions: 2 },
  { day: 'Sat', sessions: 0 },
  { day: 'Sun', sessions: 1 },
];

function formatDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function getScoreBadgeVariant(score: number): 'success' | 'warning' | 'error' {
  if (score >= 90) return 'success';
  if (score >= 70) return 'warning';
  return 'error';
}

const todayFormatted = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const GRADIENT_ID = 'barGradient';

const recentSessions = sessions.slice(0, 5);

export function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--primary)]">
          Welcome back, {currentUser.name.split(' ')[0]}
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">{todayFormatted}</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Sessions This Week */}
        <Card className="flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-2">
            <span
              className="font-display text-3xl font-bold"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              7
            </span>
            <TrendingUp size={20} className="text-[var(--success)]" />
          </div>
          <span className="text-sm text-[var(--text-secondary)] mt-1">Sessions This Week</span>
        </Card>

        {/* Problems Solved */}
        <Card className="flex flex-col items-center justify-center text-center">
          <span
            className="font-display text-3xl font-bold"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            23
          </span>
          <span className="text-sm text-[var(--text-secondary)] mt-1">Problems Solved</span>
        </Card>

        {/* Avg Score */}
        <Card className="flex flex-col items-center justify-center text-center">
          <ProgressRing value={85} size={52} strokeWidth={4} />
          <span className="text-sm text-[var(--text-secondary)] mt-1">Avg Score</span>
        </Card>

        {/* Practice Time */}
        <Card className="flex flex-col items-center justify-center text-center">
          <span className="font-display text-3xl font-bold gradient-text">12.5h</span>
          <span className="text-sm text-[var(--text-secondary)] mt-1">Practice Time</span>
        </Card>
      </div>

      {/* Activity Chart */}
      <Card>
        <h2 className="font-display text-lg font-semibold mb-4">Activity</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={activityData}>
            <defs>
              <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF5A5F" />
                <stop offset="100%" stopColor="#FF9F1C" />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
            />
            <Bar
              dataKey="sessions"
              fill={`url(#${GRADIENT_ID})`}
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Two-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Sessions */}
        <div className="lg:col-span-2">
          <h2 className="font-display text-lg font-semibold mb-4">Recent Sessions</h2>
          <div className="space-y-3">
            {recentSessions.map((session) => {
              const problem = getProblem(session.problemId);
              const partner = getUser(session.partnerId);
              return (
                <Link key={session.id} to={`/dashboard/history/${session.id}`}>
                  <Card className="flex items-center justify-between cursor-pointer hover:border-[var(--primary)]/40 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar size="sm" name={partner?.name} />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          {problem?.title ?? 'Unknown Problem'}
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)]">
                          {partner?.name ?? 'Unknown'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={session.role === 'candidate' ? 'info' : 'neutral'}>
                        {session.role}
                      </Badge>
                      <Badge variant={getScoreBadgeVariant(session.scores.overall)}>
                        {session.scores.overall}
                      </Badge>
                      <span className="text-sm text-[var(--text-tertiary)] hidden sm:inline">
                        {session.duration} min
                      </span>
                      <span className="text-sm text-[var(--text-tertiary)] hidden sm:inline">
                        {formatDate(session.date)}
                      </span>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
          <div className="mt-3 text-center">
            <Link
              to="/dashboard/history"
              className="text-sm font-medium text-[var(--primary)] hover:underline"
            >
              View All
            </Link>
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="font-display text-lg font-semibold mb-4">Quick Actions</h2>
          <Card>
            <Link to="/rooms/create">
              <Button variant="primary" className="w-full mb-3">
                <Plus size={16} className="mr-2" />
                Create Room
              </Button>
            </Link>
            <Link to="/rooms/join">
              <Button variant="secondary" className="w-full mb-3">
                Join Room
              </Button>
            </Link>
            <Link
              to="/problems"
              className="block text-center text-sm text-[var(--primary)] hover:underline"
            >
              Browse Problems
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
