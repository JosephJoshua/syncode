import type { AuthUserResponse } from '@syncode/contracts';
import { Card, CardContent } from '@syncode/ui';
import { createFileRoute } from '@tanstack/react-router';
import type { LucideIcon } from 'lucide-react';
import { Calendar, Clock3, Target, TrendingUp } from 'lucide-react';
import { DashboardRecentSessions } from '@/components/dashboard-recent-sessions';
import { useAuthStore } from '@/stores/auth.store';

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
});

const DASHBOARD_STATS: Array<{
  title: string;
  value: string;
  icon: LucideIcon;
}> = [
  {
    title: 'Total Sessions',
    value: '24',
    icon: Calendar,
  },
  {
    title: 'Pass Rate',
    value: '78%',
    icon: Target,
  },
  {
    title: 'Average Score',
    value: '84%',
    icon: TrendingUp,
  },
  {
    title: 'Practice Time',
    value: '18h',
    icon: Clock3,
  },
];

function getDashboardName(user: AuthUserResponse | null) {
  if (user?.displayName?.trim()) {
    return user.displayName.trim();
  }

  if (user?.username?.trim()) {
    return user.username.trim();
  }

  if (user?.email?.trim()) {
    return user.email.split('@')[0]?.trim() || null;
  }

  return null;
}

function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const dashboardName = getDashboardName(user);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:py-12">
      <section className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {dashboardName ? `Welcome back, ${dashboardName}` : 'Welcome back'}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">
          Review your recent sessions, track your pass rate, and jump into your next practice.
        </p>
      </section>

      <section className="mt-8 sm:mt-10">
        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4 xl:gap-9">
          {DASHBOARD_STATS.map((stat) => (
            <StatCard key={stat.title} icon={stat.icon} title={stat.title} value={stat.value} />
          ))}
        </div>
      </section>

      <DashboardRecentSessions />
    </div>
  );
}

function StatCard({
  icon: Icon,
  title,
  value,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
}) {
  return (
    <Card className="border border-border/50 bg-card/80 py-2.5 backdrop-blur-sm transition-colors hover:border-primary/20 sm:py-3">
      <CardContent className="flex h-full flex-col gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5">
        <Icon className="size-5 text-primary" />

        <div className="space-y-1.5">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground/90">
            {title}
          </p>
          <p className="text-2xl font-semibold tracking-tight text-primary sm:text-[1.75rem]">
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
