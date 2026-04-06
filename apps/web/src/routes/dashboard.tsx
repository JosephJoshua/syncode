import { Card, CardContent } from '@syncode/ui';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { LucideIcon } from 'lucide-react';
import { Calendar, Clock3, Target, TrendingUp } from 'lucide-react';
import { DashboardRecentSessions } from '@/components/dashboard-recent-sessions';
import { HostControlPanel } from '@/components/host-control-panel';
import { requireAuth } from '@/lib/auth';
import {
  EMPTY_DASHBOARD_STATS,
  loadDashboardSessionHistory,
} from '@/lib/dashboard-session-history';
import { MOCK_SESSION_HISTORY_VIEWER_ID } from '@/lib/session-history.mock';
import { getUserDisplayName } from '@/lib/user-utils';
import { useAuthStore } from '@/stores/auth.store';

export const Route = createFileRoute('/dashboard')({
  beforeLoad: requireAuth,
  component: DashboardPage,
});

function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const dashboardName = getUserDisplayName(user);
  const sessionHistorySource =
    import.meta.env.VITE_DASHBOARD_USE_MOCK_SESSIONS === 'true' ? 'mock' : 'api';
  const viewerId =
    sessionHistorySource === 'mock' ? MOCK_SESSION_HISTORY_VIEWER_ID : (user?.id ?? null);
  const isQueryEnabled = sessionHistorySource === 'mock' || (isAuthenticated && Boolean(user?.id));
  const sessionHistoryQuery = useQuery({
    queryKey: ['dashboard', 'session-history', sessionHistorySource, viewerId],
    enabled: isQueryEnabled,
    queryFn: () =>
      loadDashboardSessionHistory({
        source: sessionHistorySource,
        currentUserId: viewerId,
      }),
  });
  const sessionHistory = sessionHistoryQuery.data;
  const isUnavailable = sessionHistorySource === 'api' && !isQueryEnabled;
  const stats = sessionHistory?.stats ?? EMPTY_DASHBOARD_STATS;
  const getStatValue = (value: string) => {
    if (isUnavailable) {
      return '--';
    }

    if (sessionHistoryQuery.isLoading) {
      return '...';
    }

    if (sessionHistoryQuery.isError) {
      return '--';
    }

    return value;
  };
  const dashboardStats: Array<{
    title: string;
    value: string;
    icon: LucideIcon;
  }> = [
    {
      title: 'Total Sessions',
      value: getStatValue(stats.totalSessions),
      icon: Calendar,
    },
    {
      title: 'Pass Rate',
      value: getStatValue(stats.passRate),
      icon: Target,
    },
    {
      title: 'Average Score',
      value: getStatValue(stats.averageScore),
      icon: TrendingUp,
    },
    {
      title: 'Practice Time',
      value: getStatValue(stats.practiceTime),
      icon: Clock3,
    },
  ];

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
          {dashboardStats.map((stat) => (
            <StatCard key={stat.title} icon={stat.icon} title={stat.title} value={stat.value} />
          ))}
        </div>
      </section>

      <DashboardRecentSessions
        rows={sessionHistory?.rows ?? []}
        isLoading={sessionHistoryQuery.isLoading}
        isUnavailable={isUnavailable}
        isError={sessionHistoryQuery.isError}
        onRetry={() => {
          void sessionHistoryQuery.refetch();
        }}
      />

      {/* Render mock host controls only during local development/UI testing. */}
      {import.meta.env.DEV ? <HostControlPanel /> : null}
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
