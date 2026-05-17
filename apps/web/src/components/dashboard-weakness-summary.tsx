import type { UserWeakness } from '@syncode/contracts';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Progress } from '@syncode/ui';
import { Link } from '@tanstack/react-router';
import { Activity, ArrowUpRight, BarChart3, Target } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

type WeaknessCategory = UserWeakness['category'];

interface TrendHistoryPoint {
  sessionId: string;
  problemName: string | null;
  reportedAt: string;
  score: number;
  categoryCount: number;
}

export function DashboardWeaknessSummary({
  weaknesses,
  isLoading,
  isUnavailable,
  isError,
}: {
  readonly weaknesses: UserWeakness[];
  readonly isLoading?: boolean;
  readonly isUnavailable?: boolean;
  readonly isError?: boolean;
}) {
  const { t } = useTranslation('dashboard');
  const sortedWeaknesses = useMemo(
    () =>
      [...weaknesses].sort(
        (a, b) =>
          b.frequency - a.frequency ||
          new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime(),
      ),
    [weaknesses],
  );
  const trendHistory = useMemo(() => buildTrendHistory(sortedWeaknesses), [sortedWeaknesses]);
  const maxFrequency = Math.max(...sortedWeaknesses.map((item) => item.frequency), 0);
  const isBlocked = isLoading || isUnavailable || isError;
  const blockedTitle = isLoading
    ? t('weakness.loadingTitle')
    : isUnavailable
      ? t('weakness.unavailableTitle')
      : t('weakness.errorTitle');
  const blockedDescription = isLoading
    ? t('weakness.loadingDescription')
    : isUnavailable
      ? t('weakness.unavailableDescription')
      : t('weakness.errorDescription');

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
          {t('weakness.sessionCount', { count: sortedWeaknesses.length })}
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
            {isBlocked ? (
              <EmptyState title={blockedTitle} description={blockedDescription} />
            ) : null}

            {!isBlocked && sortedWeaknesses.length === 0 ? (
              <EmptyState
                title={t('weakness.noDataTitle')}
                description={t('weakness.noDataDescription')}
              />
            ) : null}

            {!isBlocked &&
              sortedWeaknesses.map((item) => (
                <WeaknessCategoryRow key={item.id} item={item} maxFrequency={maxFrequency} />
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
            {isBlocked ? (
              <EmptyState title={blockedTitle} description={blockedDescription} />
            ) : trendHistory.length > 0 ? (
              <div className="space-y-4">
                {trendHistory.map((point) => (
                  <TrendHistoryRow key={point.sessionId} point={point} />
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
  maxFrequency,
}: {
  readonly item: UserWeakness;
  readonly maxFrequency: number;
}) {
  const { t } = useTranslation('dashboard');
  const percentage = maxFrequency > 0 ? Math.round((item.frequency / maxFrequency) * 100) : 0;
  const linkedSessions = item.sessions.slice(0, 3);

  return (
    <div className="rounded-lg border border-border/50 bg-background/45 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-medium text-foreground">
            {t(`weakness.category.${item.category}.title`)}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {item.description || t('weakness.descriptionFallback')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Badge variant={item.trend === 'worsening' ? 'warning' : 'outline'}>
            {t(`weakness.trend.${item.trend}`)}
          </Badge>
          <Badge variant="outline">{t('weakness.frequency', { count: item.frequency })}</Badge>
        </div>
      </div>
      <Progress
        value={percentage}
        className="mt-4 h-2"
        aria-label={t('weakness.frequencyProgress', {
          category: t(`weakness.category.${item.category}.title`),
          count: item.frequency,
        })}
      />
      {linkedSessions.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {linkedSessions.map((session) => (
            <Button key={session.sessionId} asChild size="xs" variant="outline">
              <Link to="/sessions/$sessionId" params={{ sessionId: session.sessionId }}>
                <ArrowUpRight className="size-3" />
                {session.problemName ?? t('weakness.unknownProblem')}
              </Link>
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TrendHistoryRow({ point }: { readonly point: TrendHistoryPoint }) {
  const { t, i18n } = useTranslation('dashboard');
  const reportedAt = new Date(point.reportedAt);
  const dateLabel = new Intl.DateTimeFormat(i18n.language, {
    month: 'short',
    day: 'numeric',
  }).format(reportedAt);
  const problemName = point.problemName ?? t('weakness.unknownProblem');

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <div className="min-w-0">
          <span className="block truncate font-medium text-foreground">{problemName}</span>
          <span className="text-xs text-muted-foreground">{dateLabel}</span>
        </div>
        <span className="text-muted-foreground">
          {t('weakness.trendScore', { score: point.score })}
        </span>
      </div>
      <Progress
        value={point.score}
        aria-label={t('weakness.trendPoint', {
          problem: problemName,
          score: point.score,
        })}
      />
      <p className="mt-1 text-xs text-muted-foreground">
        {t('weakness.categoryCount', { count: point.categoryCount })}
      </p>
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

function buildTrendHistory(weaknesses: UserWeakness[]): TrendHistoryPoint[] {
  const sessionsById = new Map<
    string,
    {
      problemName: string | null;
      reportedAt: string;
      scores: number[];
      categories: Set<WeaknessCategory>;
    }
  >();

  for (const weakness of weaknesses) {
    for (const session of weakness.sessions) {
      if (session.score == null) {
        continue;
      }

      const existing = sessionsById.get(session.sessionId);

      if (!existing) {
        sessionsById.set(session.sessionId, {
          problemName: session.problemName,
          reportedAt: session.reportedAt,
          scores: [session.score],
          categories: new Set([weakness.category]),
        });
        continue;
      }

      existing.scores.push(session.score);
      existing.categories.add(weakness.category);

      if (new Date(session.reportedAt).getTime() > new Date(existing.reportedAt).getTime()) {
        existing.reportedAt = session.reportedAt;
      }
    }
  }

  return [...sessionsById.entries()]
    .map(([sessionId, item]) => ({
      sessionId,
      problemName: item.problemName,
      reportedAt: item.reportedAt,
      score: Math.round(item.scores.reduce((sum, score) => sum + score, 0) / item.scores.length),
      categoryCount: item.categories.size,
    }))
    .sort((a, b) => new Date(a.reportedAt).getTime() - new Date(b.reportedAt).getTime())
    .slice(-6);
}
