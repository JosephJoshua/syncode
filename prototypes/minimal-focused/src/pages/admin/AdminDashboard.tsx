import { Card } from '../../components/ui/Card';

const stats = [
  { value: '128', label: 'Users' },
  { value: '8', label: 'Active Rooms' },
  { value: '1,247', label: 'Total Sessions' },
  { value: '12', label: 'Problems' },
];

const recentActivity = [
  { time: '2 min ago', event: 'User registered', user: 'Alice Chen' },
  { time: '5 min ago', event: 'Room created', user: 'Bob Park' },
  { time: '12 min ago', event: 'Session completed', user: 'Carol Wu' },
  { time: '18 min ago', event: 'Problem submitted', user: 'David Kim' },
  { time: '31 min ago', event: 'User registered', user: 'Eve Zhang' },
];

export function AdminDashboard() {
  return (
    <div>
      {/* Header */}
      <span className="font-mono text-xs tracking-widest uppercase text-[var(--accent)]">
        // admin_dashboard
      </span>
      <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
        Dashboard
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        {stats.map((stat) => (
          <Card key={stat.label} padding="p-4">
            <p className="font-mono text-2xl text-[var(--accent)]">{stat.value}</p>
            <p className="font-mono text-xs text-[var(--text-tertiary)] uppercase mt-1">
              {stat.label}
            </p>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="mt-6">
        <h2 className="font-display text-base font-semibold text-[var(--text-primary)] mb-3">
          Recent Activity
        </h2>
        <Card padding="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-default)]">
                <th className="text-left font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider px-4 py-3">
                  Time
                </th>
                <th className="text-left font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider px-4 py-3">
                  Event
                </th>
                <th className="text-left font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider px-4 py-3">
                  User
                </th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.map((activity, idx) => (
                <tr
                  key={idx}
                  className={
                    idx < recentActivity.length - 1 ? 'border-b border-[var(--border-default)]' : ''
                  }
                >
                  <td className="px-4 py-3 font-mono text-xs text-[var(--text-tertiary)]">
                    {activity.time}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                    {activity.event}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--text-primary)]">{activity.user}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
