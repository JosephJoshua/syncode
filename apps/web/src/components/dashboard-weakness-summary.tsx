import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Progress } from '@syncode/ui';
import { Link } from '@tanstack/react-router';
import { Activity, ArrowUpRight, BarChart3, Target } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { DashboardSessionRecord } from '@/lib/dashboard-session-history.js';

type WeaknessCategory = 'correctness' | 'consistency' | 'pacing' | 'difficulty';

type WeaknessSummaryItem = {
  category: WeaknessCategory;
  frequency: number;
  sessions: DashboardSessionRecord[];
};

export function DashboardWeaknessSummary({
  records,
  isLoading,
  isUnavailable,
}: {
  readonly records: DashboardSessionRecord[];
  readonly isLoading?: boolean;
  readonly isUnavailable?: boolean;
}) {
  const { t } = useTranslation('dashboard');
  const { weaknesses, trend } = useMemo(() => buildWeaknessSummary(records), [records]);
  const hasData = records.length > 0;

  return (
    <section className="mt-8 sm:mt-10">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {t('weakness.heading')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('weakness.sub')}</p>
        </div>
        <Badge variant="outline" className="w-fit">
          <Activity className="size-3.5" />
          {t('weakness.sessionCount', { count: records.length })}
        </Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
          <CardHeader className="px-5 pt-6 pb-4 sm:px-6">
            <CardTitle className="flex items-center gap-2">
              <Target className="size-5 text-primary" />
              {t('weakness.categoriesTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-6 sm:px-6">
            {isLoading || isUnavailable ? (
              <EmptyState
                title={isLoading ? t('weakness.loadingTitle') : t('weakness.unavailableTitle')}
                description={
                  isLoading
                    ? t('weakness.loadingDescription')
                    : t('weakness.unavailableDescription')
                }
              />
            ) : null}

            {!isLoading && !isUnavailable && weaknesses.length === 0 ? (
              <EmptyState
                title={hasData ? t('weakness.noWeaknessTitle') : t('weakness.noDataTitle')}
                description={
                  hasData ? t('weakness.noWeaknessDescription') : t('weakness.noDataDescription')
                }
              />
            ) : null}

            {weaknesses.map((item) => (
              <WeaknessCategoryRow key={item.category} item={item} totalSessions={records.length} />
            ))}
          </CardContent>
        </Card>

        <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
          <CardHeader className="px-5 pt-6 pb-4 sm:px-6">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-5 text-primary" />
              {t('weakness.trendTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-6 sm:px-6">
            {trend.length > 0 ? (
              <div className="flex h-56 items-end gap-2">
                {trend.map((point) => (
                  <div
                    key={point.sessionId}
                    className="flex min-w-0 flex-1 flex-col items-center gap-2"
                  >
                    <div className="flex h-40 w-full items-end rounded-t-md bg-muted/40">
                      <div
                        className="w-full rounded-t-md bg-primary/75"
                        style={{ height: `${Math.max(8, point.score)}%` }}
                        title={t('weakness.trendPoint', {
                          problem: point.problemName,
                          score: point.score,
                        })}
                      />
                    </div>
                    <span className="max-w-full truncate text-[11px] text-muted-foreground">
                      {point.score}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title={t('weakness.noTrendTitle')}
                description={t('weakness.noTrendDescription')}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function WeaknessCategoryRow({
  item,
  totalSessions,
}: {
  readonly item: WeaknessSummaryItem;
  readonly totalSessions: number;
}) {
  const { t } = useTranslation('dashboard');
  const percentage = totalSessions > 0 ? Math.round((item.frequency / totalSessions) * 100) : 0;
  const linkedSessions = item.sessions.filter((session) => session.hasReport).slice(0, 3);

  return (
    <div className="rounded-lg border border-border/50 bg-background/45 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-medium text-foreground">
            {t(`weakness.category.${item.category}.title`)}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(`weakness.category.${item.category}.description`)}
          </p>
        </div>
        <Badge variant={percentage >= 50 ? 'warning' : 'outline'}>
          {t('weakness.frequency', { count: item.frequency })}
        </Badge>
      </div>
      <Progress value={percentage} className="mt-4 h-2" />
      {linkedSessions.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {linkedSessions.map((session) => (
            <Button key={session.id} asChild size="xs" variant="outline">
              <Link to="/sessions/$sessionId" params={{ sessionId: session.id }}>
                <ArrowUpRight className="size-3" />
                {session.problemName}
              </Link>
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  readonly title: string;
  readonly description: string;
}) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center rounded-lg border border-dashed border-border/60 px-6 py-8 text-center">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function buildWeaknessSummary(records: DashboardSessionRecord[]) {
  const scoredCandidateRecords = records
    .filter((record) => record.viewerRole === 'candidate' && typeof record.score === 'number')
    .sort(
      (a, b) =>
        new Date(a.finishedAt ?? a.createdAt).getTime() -
        new Date(b.finishedAt ?? b.createdAt).getTime(),
    );

  const categories: WeaknessSummaryItem[] = (
    [
      {
        category: 'correctness',
        sessions: scoredCandidateRecords.filter((record) => (record.score ?? 0) < 60),
        frequency: 0,
      },
      {
        category: 'consistency',
        sessions: scoredCandidateRecords.filter(
          (record) => (record.score ?? 0) >= 60 && (record.score ?? 0) < 75,
        ),
        frequency: 0,
      },
      {
        category: 'pacing',
        sessions: records.filter((record) => record.durationSeconds > 45 * 60),
        frequency: 0,
      },
      {
        category: 'difficulty',
        sessions: scoredCandidateRecords.filter(
          (record) => record.difficulty === 'hard' && (record.score ?? 0) < 80,
        ),
        frequency: 0,
      },
    ] satisfies WeaknessSummaryItem[]
  ).map((item) => ({ ...item, frequency: item.sessions.length }));

  return {
    weaknesses: categories
      .filter((item) => item.frequency > 0)
      .sort((a, b) => b.frequency - a.frequency),
    trend: scoredCandidateRecords.slice(-8).map((record) => ({
      sessionId: record.id,
      problemName: record.problemName,
      score: Math.max(0, Math.min(100, Math.round(record.score ?? 0))),
    })),
  };
}
