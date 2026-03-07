import {
  Area,
  AreaChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card } from '../../components/ui/Card.tsx';

const dailyActiveUsers = [
  { day: 'Mar 1', users: 142 },
  { day: 'Mar 2', users: 158 },
  { day: 'Mar 3', users: 175 },
  { day: 'Mar 4', users: 132 },
  { day: 'Mar 5', users: 198 },
  { day: 'Mar 6', users: 215 },
  { day: 'Mar 7', users: 245 },
  { day: 'Mar 8', users: 180 },
  { day: 'Mar 9', users: 165 },
  { day: 'Mar 10', users: 210 },
  { day: 'Mar 11', users: 225 },
  { day: 'Mar 12', users: 190 },
  { day: 'Mar 13', users: 238 },
  { day: 'Mar 14', users: 250 },
];

const sessionsByDifficulty = [
  { name: 'Easy', value: 340, color: '#2EC4B6' },
  { name: 'Medium', value: 350, color: '#FF9F1C' },
  { name: 'Hard', value: 160, color: '#FF5A5F' },
];

const avgScoreTrend = [
  { week: 'W1', score: 72 },
  { week: 'W2', score: 75 },
  { week: 'W3', score: 78 },
  { week: 'W4', score: 82 },
  { week: 'W5', score: 80 },
  { week: 'W6', score: 85 },
  { week: 'W7', score: 88 },
];

const AREA_GRADIENT_ID = 'areaGradient';
const LINE_GRADIENT_ID = 'lineGradient';

export function AdminAnalytics() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Daily Active Users — full width */}
      <Card className="lg:col-span-2">
        <h2 className="font-display text-lg font-semibold mb-4">Daily Active Users</h2>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={dailyActiveUsers}>
            <defs>
              <linearGradient id={AREA_GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF5A5F" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#FF5A5F" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="users"
              stroke="#FF5A5F"
              strokeWidth={2}
              fill={`url(#${AREA_GRADIENT_ID})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Sessions by Difficulty — donut */}
      <Card>
        <h2 className="font-display text-lg font-semibold mb-4">Sessions by Difficulty</h2>
        <div className="relative">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={sessionsByDifficulty}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                dataKey="value"
                stroke="none"
              >
                {sessionsByDifficulty.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <span className="block font-display text-xl font-bold text-[var(--text-primary)]">
                850
              </span>
              <span className="block text-xs text-[var(--text-tertiary)]">Total</span>
            </div>
          </div>
        </div>
        <div className="flex justify-center gap-4 mt-2">
          {sessionsByDifficulty.map((entry) => (
            <div key={entry.name} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-xs text-[var(--text-secondary)]">{entry.name}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Avg Score Trend */}
      <Card>
        <h2 className="font-display text-lg font-semibold mb-4">Avg Score Trend</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={avgScoreTrend}>
            <defs>
              <linearGradient id={LINE_GRADIENT_ID} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#FF5A5F" />
                <stop offset="100%" stopColor="#FF9F1C" />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="week"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
            />
            <YAxis
              domain={[60, 100]}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke={`url(#${LINE_GRADIENT_ID})`}
              strokeWidth={2}
              dot={{ fill: '#FF5A5F', r: 4, strokeWidth: 0 }}
              activeDot={{ fill: '#FF5A5F', r: 6, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
