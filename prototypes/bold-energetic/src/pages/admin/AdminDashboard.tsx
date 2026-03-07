import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

import { Card } from '../../components/ui/Card.tsx';

const weeklyRegistrations = [
  { week: 'W1', users: 120 },
  { week: 'W2', users: 185 },
  { week: 'W3', users: 210 },
  { week: 'W4', users: 165 },
  { week: 'W5', users: 240 },
  { week: 'W6', users: 195 },
  { week: 'W7', users: 310 },
  { week: 'W8', users: 275 },
];

const GRADIENT_ID = 'adminBarGradient';

const recentActivity = [
  { text: 'Alice Doe completed Two Sum — 88%', color: 'bg-[var(--success)]', time: '2 min ago' },
  { text: 'Bob Chen created Room ROOM05', color: 'bg-[#3B82F6]', time: '8 min ago' },
  { text: 'New user Charlie Davis registered', color: 'bg-[var(--success)]', time: '15 min ago' },
  { text: "Problem 'Trapping Rain Water' added", color: 'bg-[#3B82F6]', time: '1 hr ago' },
  { text: 'System health check passed', color: 'bg-[var(--accent)]', time: '2 hr ago' },
];

export function AdminDashboard() {
  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="flex flex-col items-center text-center">
          <span className="font-display text-3xl font-bold gradient-text">2,487</span>
          <span className="text-sm text-[var(--text-secondary)] mt-1">Total Users</span>
        </Card>
        <Card className="flex flex-col items-center text-center">
          <span className="font-display text-3xl font-bold gradient-text">12</span>
          <span className="text-sm text-[var(--text-secondary)] mt-1">Active Rooms</span>
        </Card>
        <Card className="flex flex-col items-center text-center">
          <span className="font-display text-3xl font-bold gradient-text">10,240+</span>
          <span className="text-sm text-[var(--text-secondary)] mt-1">Total Sessions</span>
        </Card>
        <Card className="flex flex-col items-center text-center">
          <span className="font-display text-3xl font-bold gradient-text">500+</span>
          <span className="text-sm text-[var(--text-secondary)] mt-1">Problems</span>
        </Card>
      </div>

      {/* Activity Chart */}
      <Card>
        <h2 className="font-display text-lg font-semibold mb-4">Weekly Registrations</h2>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={weeklyRegistrations}>
            <defs>
              <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF5A5F" />
                <stop offset="100%" stopColor="#FF9F1C" />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="week"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Bar
              dataKey="users"
              fill={`url(#${GRADIENT_ID})`}
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Recent Activity Log */}
      <Card>
        <h2 className="font-display text-lg font-semibold mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {recentActivity.map((item) => (
            <div key={item.text} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${item.color} shrink-0`} />
                <span className="text-sm text-[var(--text-primary)]">{item.text}</span>
              </div>
              <span className="text-xs text-[var(--text-tertiary)] shrink-0 ml-4">{item.time}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
