import type { SessionReport, SessionSummary } from '@syncode/contracts';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@syncode/ui';
import { useQueries, useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Loader2,
  Plus,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { type CSSProperties, Fragment, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { fetchAllSessionHistory, formatSessionDateTime } from '@/lib/dashboard-session-history.js';
import { fetchSessionReport } from '@/lib/session-report.js';
import {
  calculateAverageDelta,
  parseSessionComparisonIds,
  resolveComparisonDimensionScore,
  resolveComparisonTrend,
  SESSION_COMPARISON_DIMENSION_KEYS,
  SESSION_COMPARISON_MAX_SELECTION,
  SESSION_COMPARISON_MIN_SELECTION,
  type SessionComparisonDimensionKey,
  type SessionComparisonTrend,
  serializeSessionComparisonIds,
} from '@/lib/session-report-comparison.js';

const compareSearchSchema = z.object({
  ids: z.string().optional().catch(undefined),
});

const sectionMotion = (index: number) => ({
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.55,
    delay: 0.06 * index,
    ease: [0.16, 1, 0.3, 1] as const,
  },
});

const trendMetaByType = {
  improving: {
    Icon: ArrowUpRight,
    chipClass: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  },
  stable: {
    Icon: ArrowRight,
    chipClass: 'border-emerald-500/20 bg-emerald-500/8 text-emerald-300/80',
  },
  declining: {
    Icon: ArrowDownRight,
    chipClass: 'border-rose-400/25 bg-rose-400/10 text-rose-200',
  },
} as const satisfies Record<
  SessionComparisonTrend,
  {
    Icon: typeof ArrowUpRight;
    chipClass: string;
  }
>;

type ComparableSession = {
  sessionId: string;
  session: SessionSummary;
  report: SessionReport;
};

type TrendPoint = {
  sessionId: string;
  label: string;
  finishedAt: string;
  score: number;
};

type CriteriaTrendRow = {
  key: SessionComparisonDimensionKey;
  points: TrendPoint[];
  trend: SessionComparisonTrend;
  averageDelta: number;
  baselineScore: number | null;
  latestScore: number | null;
};

type ComparisonInsight = {
  title: string;
  value: string;
  body: string;
};

type HoverDetails = {
  sessionId: string;
  title: string;
  timestamp: string;
  overallScore: number | null;
  dimensionScores: Array<{ key: SessionComparisonDimensionKey; score: number | null }>;
  testCasePassed: number;
  testCaseTotal: number;
};

type TestCaseSummary = {
  passed: number;
  total: number;
};

export const Route = createFileRoute('/_app/sessions/compare')({
  validateSearch: compareSearchSchema,
  component: SessionComparisonPage,
});


function SessionComparisonPage() {
  const { t } = useTranslation(['sessionComparison', 'feedback', 'common']);
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>(() =>
    parseSessionComparisonIds(search.ids),
  );

  useEffect(() => {
    setSelectedSessionIds(parseSessionComparisonIds(search.ids));
  }, [search.ids]);

  const sessionHistoryQuery = useQuery({
    queryKey: ['sessions', 'comparison', 'history'],
    queryFn: () =>
      fetchAllSessionHistory({
        sortBy: 'finishedAt',
        sortOrder: 'desc',
      }),
    retry: false,
  });

  const sessions = sessionHistoryQuery.data?.data ?? [];
  const selectableSessions = useMemo(
    () => sessions.filter((session) => session.hasReport),
    [sessions],
  );

  const sessionById = useMemo(() => {
    const map = new Map<string, SessionSummary>();
    for (const session of selectableSessions) {
      map.set(session.sessionId, session);
    }
    return map;
  }, [selectableSessions]);

  const reportQueries = useQueries({
    queries: selectedSessionIds.map((sessionId) => ({
      queryKey: ['sessions', sessionId, 'report', 'comparison'],
      queryFn: () => fetchSessionReport(sessionId),
      retry: false,
      enabled: Boolean(sessionById.get(sessionId)),
    })),
  });

  const selectedItems = useMemo(
    () =>
      selectedSessionIds
        .map((sessionId, index) => {
          const session = sessionById.get(sessionId) ?? null;
          const reportQuery = reportQueries[index];
          const reportResult = reportQuery?.data;

          return {
            sessionId,
            session,
            reportResult,
            isLoading: reportQuery?.isLoading ?? false,
            isError: reportQuery?.isError ?? false,
          };
        })
        .filter((item) => item.session !== null),
    [reportQueries, selectedSessionIds, sessionById],
  );

  const comparableSessions = useMemo(() => {
    const readyItems: ComparableSession[] = [];

    for (const item of selectedItems) {
      if (!item.session || item.reportResult?.state !== 'ready') {
        continue;
      }

      readyItems.push({
        sessionId: item.sessionId,
        session: item.session,
        report: item.reportResult.report,
      });
    }

    return readyItems;
  }, [selectedItems]);

  const chronologicalSessions = useMemo(
    () =>
      [...comparableSessions].sort(
        (left, right) =>
          new Date(left.session.finishedAt ?? left.session.createdAt).getTime() -
          new Date(right.session.finishedAt ?? right.session.createdAt).getTime(),
      ),
    [comparableSessions],
  );

  const overallTrendPoints = useMemo(() => {
    const points: TrendPoint[] = [];

    for (const item of chronologicalSessions) {
      const score = resolveComparableOverallScore(item);
      if (typeof score !== 'number') {
        continue;
      }

      points.push({
        sessionId: item.sessionId,
        label: item.session.problemTitle ?? t('sessionComparison:fallbackProblem'),
        finishedAt: item.session.finishedAt ?? item.session.createdAt,
        score,
      });
    }

    return points;
  }, [chronologicalSessions, t]);

  const pendingCount = selectedItems.filter((item) => item.reportResult?.state === 'pending').length;
  const erroredCount = selectedItems.filter((item) => item.isError).length;
  const hasEnoughSelections = selectedSessionIds.length >= SESSION_COMPARISON_MIN_SELECTION;
  const hasComparableSessions = comparableSessions.length >= SESSION_COMPARISON_MIN_SELECTION;

  const updateSelection = (nextIds: string[]) => {
    const trimmedIds = nextIds.slice(0, SESSION_COMPARISON_MAX_SELECTION);
    setSelectedSessionIds(trimmedIds);

    void navigate({
      to: '.',
      search: (current) => ({
        ...current,
        ids: serializeSessionComparisonIds(trimmedIds),
      }),
      replace: true,
    });
  };

  const toggleSessionSelection = (sessionId: string) => {
    if (selectedSessionIds.includes(sessionId)) {
      updateSelection(selectedSessionIds.filter((id) => id !== sessionId));
      return;
    }

    if (selectedSessionIds.length >= SESSION_COMPARISON_MAX_SELECTION) {
      return;
    }

    updateSelection([...selectedSessionIds, sessionId]);
  };

  return (
    <div className="relative mx-auto max-w-6xl px-4 py-8 sm:py-10 lg:py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[640px] -translate-x-1/2 rounded-full bg-primary/6 blur-[120px]"
      />

      <motion.div {...sectionMotion(0)} className="flex flex-wrap items-center justify-between gap-4">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {t('common:backToDashboard')}
        </Link>

        <Popover open={isSelectorOpen} onOpenChange={setIsSelectorOpen}>
          <PopoverTrigger asChild>
            <Button className="gap-2 bg-emerald-600 text-white hover:bg-emerald-500">
              <Plus className="size-4" />
              {t('sessionComparison:actions.compareSessions')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[360px] p-0" align="end" sideOffset={8}>
            <Command>
              <CommandInput placeholder={t('sessionComparison:selector.searchPlaceholder')} />
              <CommandList>
                <CommandEmpty>{t('sessionComparison:selector.empty')}</CommandEmpty>
                <CommandGroup>
                  {selectableSessions.map((session) => {
                    const selected = selectedSessionIds.includes(session.sessionId);
                    const disabled = !selected && selectedSessionIds.length >= SESSION_COMPARISON_MAX_SELECTION;

                    return (
                      <CommandItem
                        key={session.sessionId}
                        value={`${session.problemTitle ?? ''} ${session.sessionId}`}
                        disabled={disabled}
                        onSelect={() => toggleSessionSelection(session.sessionId)}
                        className="flex items-start justify-between gap-3 px-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {session.problemTitle ?? t('sessionComparison:fallbackProblem')}
                          </p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {formatSessionDateTime(session.finishedAt ?? session.createdAt)}
                          </p>
                        </div>
                        <Check
                          className={cn(
                            'mt-0.5 size-4 shrink-0',
                            selected ? 'opacity-100 text-emerald-500' : 'opacity-0',
                          )}
                        />
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </motion.div>

      <motion.header {...sectionMotion(1)} className="mt-5 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary/70">
          {t('sessionComparison:eyebrow')}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t('sessionComparison:heading')}
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">
          {t('sessionComparison:subheading')}
        </p>
      </motion.header>

      <main className="mt-8 space-y-6">
        <motion.div {...sectionMotion(2)}>
          <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
            <CardHeader className="px-6 py-6 pb-4">
              <CardTitle className="text-base">{t('sessionComparison:sections.selected')}</CardTitle>
              <CardDescription>
                {t('sessionComparison:selector.selectionCount', {
                  count: selectedSessionIds.length,
                  max: SESSION_COMPARISON_MAX_SELECTION,
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              {selectedItems.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedItems.map((item) => (
                    <Badge
                      key={item.sessionId}
                      variant="secondary"
                      className="flex items-center gap-1 rounded-full border border-border/60 bg-background/60 px-3 py-1"
                    >
                      <span className="max-w-62 truncate">
                        {item.session?.problemTitle ?? t('sessionComparison:fallbackProblem')}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleSessionSelection(item.sessionId)}
                        aria-label={t('sessionComparison:actions.removeSession')}
                        className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('sessionComparison:selector.noneSelected')}</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {sessionHistoryQuery.isLoading ? (
          <motion.div {...sectionMotion(3)}>
            <InfoCard title={t('sessionComparison:state.loadingSessions')} body={t('sessionComparison:state.loadingSessionsBody')} loading />
          </motion.div>
        ) : sessionHistoryQuery.isError ? (
          <motion.div {...sectionMotion(3)}>
            <InfoCard title={t('sessionComparison:state.sessionsLoadFailed')} body={t('common:genericError')} />
          </motion.div>
        ) : !hasEnoughSelections ? (
          <motion.div {...sectionMotion(3)}>
            <InfoCard title={t('sessionComparison:state.needMoreSelections')} body={t('sessionComparison:state.needMoreSelectionsBody')} />
          </motion.div>
        ) : !hasComparableSessions ? (
          <motion.div {...sectionMotion(3)}>
            <InfoCard title={t('sessionComparison:state.waitingForReports')} body={t('sessionComparison:state.waitingForReportsBody')} loading={selectedItems.some((item) => item.isLoading)} />
          </motion.div>
        ) : (
          <>
            {(pendingCount > 0 || erroredCount > 0) && (
              <motion.div
                {...sectionMotion(3)}
                className="rounded-xl border border-border/60 bg-background/40 px-4 py-3 text-sm text-muted-foreground"
              >
                {pendingCount > 0 ? <p>{t('sessionComparison:state.pendingReports', { count: pendingCount })}</p> : null}
                {erroredCount > 0 ? <p>{t('sessionComparison:state.failedReports', { count: erroredCount })}</p> : null}
              </motion.div>
            )}

            <motion.div {...sectionMotion(4)}>
              <Card className="border border-emerald-500/12 bg-card/80 py-0 backdrop-blur-sm">
                <CardHeader className="px-6 py-6 pb-3">
                  <CardTitle>{t('sessionComparison:sections.trend')}</CardTitle>
                  <CardDescription>{t('sessionComparison:sections.trendDescription')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 px-6 pb-6">
                  <SimpleTrendSummary points={overallTrendPoints} t={t} />
                  <SessionProgressionRail sessions={chronologicalSessions} t={t} />
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </main>
    </div>
  );
}

function SimpleTrendSummary({
  points,
  t,
}: {
  points: TrendPoint[];
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  if (points.length < 2) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-background/45 px-5 py-12 text-center text-sm text-muted-foreground">
        {t('sessionComparison:state.noTrendData')}
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {points.map((point, index) => (
        <div key={point.sessionId} className="rounded-2xl border border-border/60 bg-background/50 px-4 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-primary/60">
            {t(`sessionComparison:metrics.${resolveProgressionLabelKey(index, points.length)}`)}
          </p>
          <p className="mt-3 truncate text-sm font-semibold text-foreground">{point.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{formatSessionDateTime(point.finishedAt)}</p>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-emerald-300">{Math.round(point.score)}</p>
        </div>
      ))}
    </div>
  );
}

function SessionProgressionRail({
  sessions,
  t,
}: {
  sessions: ComparableSession[];
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  if (sessions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary/60">
          {t('sessionComparison:sections.progression')}
        </span>
        <span aria-hidden className="h-px flex-1 bg-emerald-500/12" />
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-stretch md:gap-4">
        {sessions.map((item, index) => {
          const score = resolveComparableOverallScore(item);
          const isLatest = index === sessions.length - 1;
          const labelKey = resolveProgressionLabelKey(index, sessions.length);

          return (
            <div key={item.sessionId} className="flex flex-1 items-center gap-4">
              <Link
                to="/sessions/$sessionId"
                params={{ sessionId: item.sessionId }}
                className={cn(
                  'min-w-0 flex-1 rounded-2xl border bg-background/55 p-4 transition-colors',
                  isLatest
                    ? 'border-emerald-400/35 shadow-[0_0_0_1px_rgba(52,211,153,0.08),0_16px_40px_rgba(16,185,129,0.12)]'
                    : 'border-border/60 hover:border-emerald-500/20',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary/70">
                    {t(`sessionComparison:metrics.${labelKey}`)}
                  </span>
                  {isLatest ? (
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-emerald-200">
                      {t('sessionComparison:metrics.latest')}
                    </span>
                  ) : null}
                </div>

                <p className="mt-4 truncate text-sm font-semibold text-foreground">
                  {item.session.problemTitle ?? t('sessionComparison:fallbackProblem')}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatSessionDateTime(item.session.finishedAt ?? item.session.createdAt)}
                </p>

                <div className="mt-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    {t('sessionComparison:metrics.overallScore')}
                  </p>
                  <p className="mt-1 text-3xl font-semibold tracking-tight text-emerald-300">
                    {formatScore(score)}
                  </p>
                </div>
              </Link>

              {index < sessions.length - 1 ? (
                <div className="hidden w-8 shrink-0 items-center md:flex">
                  <div className="h-px w-full bg-gradient-to-r from-emerald-500/25 via-emerald-400/45 to-emerald-300/70" />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InfoCard({
  title,
  body,
  loading = false,
}: {
  title: string;
  body: string;
  loading?: boolean;
}) {
  return (
    <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
      <CardContent className="flex min-h-52 flex-col items-center justify-center px-6 py-10 text-center">
        {loading ? <Loader2 className="mb-3 size-4 animate-spin text-primary" /> : null}
        <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}

function resolveComparableOverallScore(session: ComparableSession) {
  if (typeof session.report.overallScore === 'number') {
    return session.report.overallScore;
  }

  return session.session.overallScore;
}

function resolveProgressionLabelKey(index: number, total: number) {
  if (index === 0) {
    return 'baseline' as const;
  }

  if (index === total - 1) {
    return 'latest' as const;
  }

  return 'checkpoint' as const;
}

function summarizeTestCaseBreakdown(report: SessionReport): TestCaseSummary {
  const breakdown = report.testCaseBreakdown ?? [];
  return {
    passed: breakdown.filter((item) => item.passed === true).length,
    total: breakdown.length,
  };
}

function buildCircleSize(score: number) {
  return 38 + (score / 100) * 24;
}

function formatSignedWhole(value: number) {
  const rounded = Math.round(value);
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

function formatSignedOneDecimal(value: number) {
  const rounded = Number(value.toFixed(1));
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

function formatScore(value: number | null) {
  return typeof value === 'number' ? Math.round(value) : '-';
}

function resolveSessionSummaryStatus(session: SessionSummary) {
  if (typeof session.overallScore !== 'number') {
    return null;
  }

  return session.overallScore >= 60 ? ('passed' as const) : ('failed' as const);
}

function getSessionStatusBadgeVariant(status: 'passed' | 'failed' | null) {
  if (status === 'passed') {
    return 'success' as const;
  }

  if (status === 'failed') {
    return 'warning' as const;
  }

  return 'neutral' as const;
}

function getSessionScoreTextClass(status: 'passed' | 'failed' | null) {
  return status === 'passed'
    ? 'text-primary'
    : status === 'failed'
      ? 'text-amber-400'
      : 'text-foreground';
}

function getResponsiveSessionGridClass(count: number) {
  return count >= 3 ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-3' : 'grid gap-4 md:grid-cols-2';
}

function buildCriteriaLaneGridStyle(pointCount: number): CSSProperties {
  return {
    gridTemplateColumns: Array.from({ length: pointCount * 2 - 1 }, (_, index) =>
      index % 2 === 0 ? 'minmax(0, 1fr)' : 'minmax(2rem, 0.65fr)',
    ).join(' '),
  };
}

