import { Card, CardContent } from '@syncode/ui';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { LucideIcon } from 'lucide-react';
import { Calendar, Clock3, Target, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DashboardRecentSessions } from '@/components/dashboard-recent-sessions.js';
import {
  EMPTY_DASHBOARD_STATS,
  fetchDashboardSessionHistory,
} from '@/lib/dashboard-session-history.js';
import { getUserDisplayName } from '@/lib/user-utils.js';
import { useAuthStore } from '@/stores/auth.store.js';

export const Route = createFileRoute('/_app/dashboard')({
  component: DashboardPage,
});

function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const dashboardName = getUserDisplayName(user);
  const viewerId = user?.id ?? null;
  const isQueryEnabled = isAuthenticated && Boolean(viewerId);
  const sessionHistoryQuery = useQuery({
    queryKey: ['dashboard', 'session-history', viewerId],
    enabled: isQueryEnabled,
    queryFn: () => fetchDashboardSessionHistory(viewerId!),
  });
  const sessionHistory = sessionHistoryQuery.data;
  const isUnavailable = !isQueryEnabled;
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
      title: t('stats.totalSessions'),
      value: getStatValue(stats.totalSessions),
      icon: Calendar,
    },
    {
      title: t('stats.passRate'),
      value: getStatValue(stats.passRate),
      icon: Target,
    },
    {
      title: t('stats.averageScore'),
      value: getStatValue(stats.averageScore),
      icon: TrendingUp,
    },
    {
      title: t('stats.practiceTime'),
      value: getStatValue(stats.practiceTime),
      icon: Clock3,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:py-12">
      <section className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {dashboardName ? t('heading', { name: dashboardName }) : t('headingNoName')}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">{t('sub')}</p>
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
