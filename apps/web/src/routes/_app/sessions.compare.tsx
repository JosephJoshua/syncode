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

type SessionReportResult = Awaited<ReturnType<typeof fetchSessionReport>>;

type ReportQueryLike = {
  data?: SessionReportResult;
  isLoading?: boolean;
  isError?: boolean;
};

type SelectedSessionItem = {
  sessionId: string;
  session: SessionSummary;
  reportResult?: SessionReportResult;
  isLoading: boolean;
  isError: boolean;
};

type TranslationFn = (key: string, options?: Record<string, unknown>) => string;
type NavigateFn = ReturnType<typeof useNavigate>;

export const Route = createFileRoute('/_app/sessions/compare')({
  validateSearch: compareSearchSchema,
  component: SessionComparisonPage,
});

function SessionComparisonPage() {
  const { t } = useTranslation(['sessionComparison', 'feedback', 'common', 'dashboard']);
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>(() =>
    parseSessionComparisonIds(search.ids),
  );
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);

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
  const sessionById = useMemo(() => buildSessionById(selectableSessions), [selectableSessions]);

  const reportQueries = useQueries({
    queries: selectedSessionIds.map((sessionId) => ({
      queryKey: ['sessions', sessionId, 'report', 'comparison'],
      queryFn: () => fetchSessionReport(sessionId),
      retry: false,
      enabled: Boolean(sessionById.get(sessionId)),
    })),
  });

  const selectedItems = useMemo(
    () => buildSelectedSessionItems(selectedSessionIds, sessionById, reportQueries),
    [reportQueries, selectedSessionIds, sessionById],
  );

  const comparableSessions = useMemo(() => buildComparableSessions(selectedItems), [selectedItems]);

  const chronologicalSessions = useMemo(
    () => buildChronologicalSessions(comparableSessions),
    [comparableSessions],
  );

  const overallTrendPoints = useMemo(
    () => buildOverallTrendPoints(chronologicalSessions, t),
    [chronologicalSessions, t],
  );

  useEffect(() => {
    const nextHoveredSessionId = resolveNextHoveredSessionId(overallTrendPoints, hoveredSessionId);
    if (nextHoveredSessionId !== hoveredSessionId) {
      setHoveredSessionId(nextHoveredSessionId);
    }
  }, [hoveredSessionId, overallTrendPoints]);

  const criteriaTrendRows = useMemo(
    () => buildCriteriaTrendRows(chronologicalSessions, t),
    [chronologicalSessions, t],
  );

  const comparisonInsights = useMemo(
    () => buildComparisonInsights(chronologicalSessions, criteriaTrendRows, t),
    [chronologicalSessions, criteriaTrendRows, t],
  );

  const hoverDetails = useMemo(
    () => buildHoverDetails(chronologicalSessions, hoveredSessionId, t),
    [chronologicalSessions, hoveredSessionId, t],
  );

  const testCaseSummaries = useMemo(
    () => buildTestCaseSummaries(chronologicalSessions, t),
    [chronologicalSessions, t],
  );

  const pendingCount = selectedItems.filter(
    (item) => item.reportResult?.state === 'pending',
  ).length;
  const erroredCount = selectedItems.filter((item) => item.isError).length;

  const hasEnoughSelections = selectedSessionIds.length >= SESSION_COMPARISON_MIN_SELECTION;
  const hasComparableSessions = comparableSessions.length >= SESSION_COMPARISON_MIN_SELECTION;

  const updateSelection = (nextIds: string[]) => {
    const trimmedIds = nextIds.slice(0, SESSION_COMPARISON_MAX_SELECTION);
    setSelectedSessionIds(trimmedIds);
    syncSelectionSearch(navigate, trimmedIds);
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

      <motion.div
        {...sectionMotion(0)}
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {t('common:backToDashboard')}
        </Link>

        <SessionSelectorPopover
          isOpen={isSelectorOpen}
          onOpenChange={setIsSelectorOpen}
          selectableSessions={selectableSessions}
          selectedSessionIds={selectedSessionIds}
          onToggleSession={toggleSessionSelection}
          t={t}
        />
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
              <CardTitle className="text-base">
                {t('sessionComparison:sections.selected')}
              </CardTitle>
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
                <p className="text-sm text-muted-foreground">
                  {t('sessionComparison:selector.noneSelected')}
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {sessionHistoryQuery.isLoading ? (
          <motion.div {...sectionMotion(3)}>
            <InfoCard
              title={t('sessionComparison:state.loadingSessions')}
              body={t('sessionComparison:state.loadingSessionsBody')}
              loading
            />
          </motion.div>
        ) : sessionHistoryQuery.isError ? (
          <motion.div {...sectionMotion(3)}>
            <InfoCard
              title={t('sessionComparison:state.sessionsLoadFailed')}
              body={t('common:genericError')}
            />
          </motion.div>
        ) : !hasEnoughSelections ? (
          <motion.div {...sectionMotion(3)}>
            <InfoCard
              title={t('sessionComparison:state.needMoreSelections')}
              body={t('sessionComparison:state.needMoreSelectionsBody')}
            />
          </motion.div>
        ) : !hasComparableSessions ? (
          <motion.div {...sectionMotion(3)}>
            <InfoCard
              title={t('sessionComparison:state.waitingForReports')}
              body={t('sessionComparison:state.waitingForReportsBody')}
              loading={selectedItems.some((item) => item.isLoading)}
            />
          </motion.div>
        ) : (
          <>
            {(pendingCount > 0 || erroredCount > 0) && (
              <motion.div
                {...sectionMotion(3)}
                className="rounded-xl border border-border/60 bg-background/40 px-4 py-3 text-sm text-muted-foreground"
              >
                {pendingCount > 0 ? (
                  <p>{t('sessionComparison:state.pendingReports', { count: pendingCount })}</p>
                ) : null}
                {erroredCount > 0 ? (
                  <p>{t('sessionComparison:state.failedReports', { count: erroredCount })}</p>
                ) : null}
              </motion.div>
            )}

            <motion.div {...sectionMotion(4)}>
              <Card className="border border-emerald-500/12 bg-card/80 py-0 backdrop-blur-sm">
                <CardHeader className="px-6 py-6 pb-3">
                  <CardTitle>{t('sessionComparison:sections.trend')}</CardTitle>
                  <CardDescription>
                    {t('sessionComparison:sections.trendDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 px-6 pb-6">
                  <HeroTrendChart
                    points={overallTrendPoints}
                    inspectLabel={t('sessionComparison:metrics.inspectTrendChart')}
                    hoveredSessionId={hoveredSessionId}
                    onHoverSessionIdChange={setHoveredSessionId}
                    noDataLabel={t('sessionComparison:state.noTrendData')}
                  />
                  <HoverDetailsPanel details={hoverDetails} t={t} />
                  <SessionProgressionRail sessions={chronologicalSessions} t={t} />
                  {comparisonInsights.length > 0 ? (
                    <ComparisonInsights insights={comparisonInsights} t={t} />
                  ) : null}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div {...sectionMotion(5)}>
              <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
                <CardHeader className="px-6 py-6 pb-3">
                  <CardTitle>{t('sessionComparison:sections.testCases')}</CardTitle>
                  <CardDescription>
                    {t('sessionComparison:sections.testCasesDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                  <TestCaseComparisonRow summaries={testCaseSummaries} t={t} />
                </CardContent>
              </Card>
            </motion.div>

            <motion.div {...sectionMotion(6)}>
              <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
                <CardHeader className="px-6 py-6 pb-3">
                  <CardTitle>{t('sessionComparison:sections.criteriaTrends')}</CardTitle>
                  <CardDescription>
                    {t('sessionComparison:sections.criteriaTrendsDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                  <div className="space-y-1">
                    {criteriaTrendRows.map((row, index) => (
                      <CriteriaTrendLane key={row.key} row={row} index={index} t={t} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </main>
    </div>
  );
}

function SessionSelectorPopover({
  isOpen,
  onOpenChange,
  selectableSessions,
  selectedSessionIds,
  onToggleSession,
  t,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectableSessions: SessionSummary[];
  selectedSessionIds: string[];
  onToggleSession: (sessionId: string) => void;
  t: TranslationFn;
}) {
  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button className="gap-2 bg-emerald-600 text-white hover:bg-emerald-500">
          <Plus className="size-4" />
          {t('sessionComparison:actions.compareSessions')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] max-w-[calc(100vw-2rem)] p-0" align="end" sideOffset={8}>
        <Command>
          <CommandInput placeholder={t('sessionComparison:selector.searchPlaceholder')} />
          <CommandList>
            <CommandEmpty>{t('sessionComparison:selector.empty')}</CommandEmpty>
            <CommandGroup>
              {selectableSessions.map((session) => (
                <SessionSelectorOption
                  key={session.sessionId}
                  session={session}
                  selectedSessionIds={selectedSessionIds}
                  onToggleSession={onToggleSession}
                  t={t}
                />
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function SessionSelectorOption({
  session,
  selectedSessionIds,
  onToggleSession,
  t,
}: {
  session: SessionSummary;
  selectedSessionIds: string[];
  onToggleSession: (sessionId: string) => void;
  t: TranslationFn;
}) {
  const selected = selectedSessionIds.includes(session.sessionId);
  const disabled = !selected && selectedSessionIds.length >= SESSION_COMPARISON_MAX_SELECTION;
  const status = resolveSessionSummaryStatus(session);

  return (
    <CommandItem
      value={`${session.problemTitle ?? ''} ${session.sessionId}`}
      disabled={disabled}
      onSelect={() => onToggleSession(session.sessionId)}
      className={cn(
        'flex items-start justify-between gap-3 px-3 py-3',
        selected && 'bg-emerald-500/8',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {session.problemTitle ?? t('sessionComparison:fallbackProblem')}
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {formatSessionDateTime(session.finishedAt ?? session.createdAt)}
        </p>
        {status || typeof session.overallScore === 'number' ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {status ? (
              <Badge variant={getSessionStatusBadgeVariant(status)} className="px-2 py-0.5">
                {status === 'passed' ? t('dashboard:status.pass') : t('dashboard:status.failed')}
              </Badge>
            ) : null}
            {typeof session.overallScore === 'number' ? (
              <span className={cn('text-xs font-medium', getSessionScoreTextClass(status))}>
                {Math.round(session.overallScore)} / 100
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <span
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors',
          selected
            ? 'border-emerald-400/20 bg-emerald-500 text-white'
            : 'border-border/60 bg-background/70 text-transparent',
        )}
      >
        <Check className="size-3.5" />
      </span>
    </CommandItem>
  );
}
function HeroTrendChart({
  inspectLabel,
  points,
  hoveredSessionId,
  onHoverSessionIdChange,
  noDataLabel,
}: {
  inspectLabel: string;
  points: TrendPoint[];
  hoveredSessionId: string | null;
  onHoverSessionIdChange: (sessionId: string) => void;
  noDataLabel: string;
}) {
  if (points.length < 2) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-background/45 px-5 py-12 text-center text-sm text-muted-foreground">
        {noDataLabel}
      </div>
    );
  }

  const width = 960;
  const height = 340;
  const paddingLeft = 8;
  const paddingRight = 4;
  const paddingTop = 20;
  const paddingBottom = 36;
  const usableWidth = width - paddingLeft - paddingRight;
  const usableHeight = height - paddingTop - paddingBottom;
  const baselineY = height - paddingBottom;

  const chartPoints = points.map((point, index) => ({
    ...point,
    x: paddingLeft + (usableWidth * index) / (points.length - 1),
    y: paddingTop + ((100 - point.score) / 100) * usableHeight,
  }));

  const linePoints = chartPoints.map((point) => `${point.x},${point.y}`).join(' ');
  const polygonPoints = [
    `${chartPoints[0]?.x ?? paddingLeft},${baselineY}`,
    linePoints,
    `${chartPoints[chartPoints.length - 1]?.x ?? width - paddingRight},${baselineY}`,
  ].join(' ');
  const latestSessionId = points[points.length - 1]?.sessionId ?? null;

  const updateNearestPoint = (clientX: number, rect: DOMRect) => {
    if (rect.width <= 0) {
      return;
    }

    const relativeX = ((clientX - rect.left) / rect.width) * width;
    const nearestPoint = chartPoints.reduce((closest, point) =>
      Math.abs(point.x - relativeX) < Math.abs(closest.x - relativeX) ? point : closest,
    );

    if (nearestPoint.sessionId !== hoveredSessionId) {
      onHoverSessionIdChange(nearestPoint.sessionId);
    }
  };

  return (
    <div className="rounded-2xl border border-emerald-500/12 bg-gradient-to-b from-emerald-500/8 via-background/40 to-background/70 p-3">
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-72 w-full"
          role="img"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="comparison-overall-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(110,231,183,0.28)" />
              <stop offset="100%" stopColor="rgba(16,185,129,0)" />
            </linearGradient>
          </defs>

          {[0, 25, 50, 75, 100].map((tick) => {
            const y = paddingTop + ((100 - tick) / 100) * usableHeight;
            return (
              <g key={tick}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="rgba(52,211,153,0.12)"
                  strokeDasharray="4 7"
                />
                <text
                  x="0"
                  y={y + 3}
                  textAnchor="start"
                  className="fill-muted-foreground text-[10px]"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          <polygon fill="url(#comparison-overall-area)" points={polygonPoints} />
          <polyline fill="none" stroke="#6ee7b7" strokeWidth="3.5" points={linePoints} />

          {chartPoints.map((point, index) => {
            const isLatest = index === chartPoints.length - 1;
            const isHovered = point.sessionId === hoveredSessionId;

            return (
              <g key={point.sessionId}>
                <line
                  x1={point.x}
                  y1={point.y}
                  x2={point.x}
                  y2={baselineY}
                  stroke={isHovered ? 'rgba(167,243,208,0.4)' : 'rgba(52,211,153,0.08)'}
                />
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isHovered ? '9' : isLatest ? '7' : '5.5'}
                  fill={isHovered ? '#d1fae5' : isLatest ? '#a7f3d0' : '#86efac'}
                  stroke="#022c22"
                  strokeWidth="2"
                />
              </g>
            );
          })}
        </svg>

        <button
          type="button"
          className="absolute inset-0 z-10 rounded-xl bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
          aria-label={inspectLabel}
          onFocus={() => {
            if (latestSessionId) {
              onHoverSessionIdChange(latestSessionId);
            }
          }}
          onKeyDown={(event) => {
            const currentIndex = chartPoints.findIndex(
              (point) => point.sessionId === hoveredSessionId,
            );
            const safeIndex = currentIndex >= 0 ? currentIndex : chartPoints.length - 1;
            const previousPoint = chartPoints[safeIndex - 1];
            const nextPoint = chartPoints[safeIndex + 1];

            if (event.key === 'ArrowLeft' && previousPoint) {
              event.preventDefault();
              onHoverSessionIdChange(previousPoint.sessionId);
            }

            if (event.key === 'ArrowRight' && nextPoint) {
              event.preventDefault();
              onHoverSessionIdChange(nextPoint.sessionId);
            }
          }}
          onMouseLeave={() => {
            if (latestSessionId) {
              onHoverSessionIdChange(latestSessionId);
            }
          }}
          onMouseMove={(event) =>
            updateNearestPoint(event.clientX, event.currentTarget.getBoundingClientRect())
          }
        />
      </div>
    </div>
  );
}

function HoverDetailsPanel({
  details,
  t,
}: {
  details: HoverDetails | null;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  if (!details) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-background/55 px-5 py-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary/70">
            {t('sessionComparison:metrics.inspectSession')}
          </p>
          <p className="mt-2 text-lg font-semibold text-foreground">{details.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{details.timestamp}</p>
        </div>
        <div className="rounded-xl border border-emerald-400/18 bg-emerald-400/8 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-primary/70">
            {t('sessionComparison:metrics.overallScore')}
          </p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-emerald-300">
            {formatScore(details.overallScore)}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {details.dimensionScores.map((item) => (
          <div key={item.key} className="rounded-xl border border-border/60 bg-card/40 px-3 py-3">
            <p className="text-xs text-muted-foreground">
              {t(`feedback:dimensions.${item.key}.title`)}
            </p>
            <p className="mt-2 text-lg font-semibold text-foreground">{formatScore(item.score)}</p>
          </div>
        ))}
        <div className="rounded-xl border border-border/60 bg-card/40 px-3 py-3">
          <p className="text-xs text-muted-foreground">
            {t('sessionComparison:sections.testCases')}
          </p>
          <p className="mt-2 text-lg font-semibold text-foreground">
            {t('sessionComparison:metrics.testCasesPassed', {
              passed: details.testCasePassed,
              total: details.testCaseTotal,
            })}
          </p>
        </div>
      </div>
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

function ComparisonInsights({
  insights,
  t,
}: {
  insights: ComparisonInsight[];
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary/60">
          {t('sessionComparison:sections.notes')}
        </span>
        <span aria-hidden className="h-px flex-1 bg-emerald-500/12" />
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {insights.map((insight) => (
          <div
            key={insight.title}
            className="rounded-2xl border border-border/60 bg-background/50 px-4 py-4"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-primary/60">
              {insight.title}
            </p>
            <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">
              {insight.value}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{insight.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TestCaseComparisonRow({
  summaries,
  t,
}: {
  summaries: Array<{
    sessionId: string;
    problemTitle: string;
    timestamp: string;
    progressionLabel: 'baseline' | 'checkpoint' | 'latest';
    summary: TestCaseSummary;
  }>;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <div className={getResponsiveSessionGridClass(summaries.length)}>
      {summaries.map((item) => (
        <div
          key={item.sessionId}
          className="rounded-2xl border border-border/60 bg-background/50 px-4 py-4"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-primary/60">
              {t(`sessionComparison:metrics.${item.progressionLabel}`)}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatSessionDateTime(item.timestamp)}
            </span>
          </div>

          <p className="mt-3 truncate text-sm font-semibold text-foreground">{item.problemTitle}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-emerald-300">
            {t('sessionComparison:metrics.testCasesPassed', {
              passed: item.summary.passed,
              total: item.summary.total,
            })}
          </p>

          {item.summary.total > 0 ? (
            <div className="mt-4 flex gap-1">
              {Array.from({ length: item.summary.total }, (_, index) => {
                const isPassed = index < item.summary.passed;
                return (
                  <span
                    key={`${item.sessionId}-${index}`}
                    className={cn(
                      'h-2 flex-1 rounded-full',
                      isPassed ? 'bg-emerald-400/85' : 'bg-border/70',
                    )}
                  />
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              {t('sessionComparison:metrics.noTestCaseBreakdown')}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function CriteriaTrendLane({
  row,
  index,
  t,
}: {
  row: CriteriaTrendRow;
  index: number;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const trendMeta = trendMetaByType[row.trend];

  return (
    <div
      className={cn(
        'grid gap-4 py-5 lg:grid-cols-[220px_minmax(0,1fr)]',
        index < SESSION_COMPARISON_DIMENSION_KEYS.length - 1 ? 'border-b border-border/40' : '',
      )}
    >
      <div className="space-y-2">
        <p className="text-base font-semibold text-foreground">
          {t(`feedback:dimensions.${row.key}.title`)}
        </p>
        <p className="text-sm text-muted-foreground">
          {t('sessionComparison:metrics.averageDelta', {
            value: formatSignedOneDecimal(row.averageDelta),
          })}
        </p>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em]',
            trendMeta.chipClass,
          )}
        >
          <trendMeta.Icon className="size-3.5" />
          {t(`feedback:trend.${row.trend}`)}
        </span>
      </div>

      <div className="overflow-x-auto">
        <div
          className={cn(
            'grid items-center gap-x-3 gap-y-4 py-1',
            row.points.length >= 3 ? 'min-w-[30rem] sm:min-w-0' : 'min-w-[22rem] sm:min-w-0',
          )}
          style={buildCriteriaLaneGridStyle(row.points.length)}
        >
          {row.points.map((point, pointIndex) => {
            const previousScore = row.points[pointIndex - 1]?.score;
            const hasDeclined = typeof previousScore === 'number' && point.score < previousScore;
            const labelKey = resolveProgressionLabelKey(pointIndex, row.points.length);
            const nextScore = row.points[pointIndex + 1]?.score;

            return (
              <Fragment key={point.sessionId}>
                <div className="flex flex-col items-center gap-2 justify-self-center">
                  <CriteriaScoreRing
                    delay={0.06 * pointIndex}
                    hasDeclined={hasDeclined}
                    score={point.score}
                  />
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {t(`sessionComparison:metrics.${labelKey}`)}
                  </span>
                </div>

                {pointIndex < row.points.length - 1 ? (
                  <div className="flex items-center">
                    <div
                      className={cn(
                        'h-px w-full',
                        typeof nextScore === 'number' && nextScore < point.score
                          ? 'bg-gradient-to-r from-emerald-400/55 to-rose-400/55'
                          : 'bg-gradient-to-r from-emerald-500/25 via-emerald-400/45 to-emerald-300/65',
                      )}
                    />
                  </div>
                ) : null}
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CriteriaScoreRing({
  score,
  hasDeclined,
  delay,
}: {
  score: number;
  hasDeclined: boolean;
  delay: number;
}) {
  const size = buildCircleSize(score);
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference - (score / 100) * circumference;
  const stroke = hasDeclined ? '#fb7185' : '#62f0a8';
  const textClass = hasDeclined ? 'text-rose-200' : 'text-emerald-100';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{
        duration: 0.45,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="relative flex items-center justify-center"
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      <svg
        aria-hidden="true"
        className="absolute inset-0 -rotate-90"
        focusable="false"
        height={size}
        width={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke="rgba(148,163,184,0.22)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          initial={{ strokeDashoffset: circumference }}
          r={radius}
          stroke={stroke}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
          style={{ strokeDasharray: circumference }}
          transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1], delay: delay + 0.08 }}
          viewport={{ once: true, amount: 0.4 }}
          whileInView={{ strokeDashoffset: progress }}
        />
      </svg>

      <span className={cn('relative text-sm font-semibold tracking-tight', textClass)}>
        {Math.round(score)}
      </span>
    </motion.div>
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

function buildSessionById(sessions: SessionSummary[]) {
  return new Map(sessions.map((session) => [session.sessionId, session]));
}

function buildSelectedSessionItems(
  selectedSessionIds: string[],
  sessionById: Map<string, SessionSummary>,
  reportQueries: ReportQueryLike[],
) {
  return selectedSessionIds.flatMap((sessionId, index) => {
    const session = sessionById.get(sessionId);
    if (!session) {
      return [];
    }

    const reportQuery = reportQueries[index];
    return [
      {
        sessionId,
        session,
        reportResult: reportQuery?.data,
        isLoading: reportQuery?.isLoading ?? false,
        isError: reportQuery?.isError ?? false,
      } satisfies SelectedSessionItem,
    ];
  });
}

function buildComparableSessions(selectedItems: SelectedSessionItem[]) {
  return selectedItems.flatMap((item) =>
    item.reportResult?.state === 'ready'
      ? [
          {
            sessionId: item.sessionId,
            session: item.session,
            report: item.reportResult.report,
          } satisfies ComparableSession,
        ]
      : [],
  );
}

function buildChronologicalSessions(comparableSessions: ComparableSession[]) {
  return [...comparableSessions].sort(
    (left, right) =>
      new Date(left.session.finishedAt ?? left.session.createdAt).getTime() -
      new Date(right.session.finishedAt ?? right.session.createdAt).getTime(),
  );
}

function buildTrendPoint(session: ComparableSession, score: number, t: TranslationFn): TrendPoint {
  return {
    sessionId: session.sessionId,
    label: session.session.problemTitle ?? t('sessionComparison:fallbackProblem'),
    finishedAt: session.session.finishedAt ?? session.session.createdAt,
    score,
  };
}

function buildOverallTrendPoints(chronologicalSessions: ComparableSession[], t: TranslationFn) {
  return chronologicalSessions.flatMap((session) => {
    const score = resolveComparableOverallScore(session);
    return typeof score === 'number' ? [buildTrendPoint(session, score, t)] : [];
  });
}

function resolveNextHoveredSessionId(points: TrendPoint[], hoveredSessionId: string | null) {
  const latestSessionId = points.at(-1)?.sessionId ?? null;
  if (!latestSessionId) {
    return null;
  }

  return points.some((point) => point.sessionId === hoveredSessionId)
    ? hoveredSessionId
    : latestSessionId;
}

function buildCriteriaTrendRows(chronologicalSessions: ComparableSession[], t: TranslationFn) {
  return SESSION_COMPARISON_DIMENSION_KEYS.map((key) => {
    const points = chronologicalSessions.flatMap((session) => {
      const score = resolveComparisonDimensionScore(session.report, key);
      return typeof score === 'number' ? [buildTrendPoint(session, score, t)] : [];
    });
    const values = points.map((point) => point.score);

    return {
      key,
      points,
      trend: resolveComparisonTrend(values),
      averageDelta: calculateAverageDelta(values),
      baselineScore: points[0]?.score ?? null,
      latestScore: points.at(-1)?.score ?? null,
    } satisfies CriteriaTrendRow;
  });
}

function buildComparisonInsights(
  chronologicalSessions: ComparableSession[],
  criteriaTrendRows: CriteriaTrendRow[],
  t: TranslationFn,
) {
  const baselineSession = chronologicalSessions[0];
  const latestSession = chronologicalSessions.at(-1);
  if (!baselineSession || !latestSession) {
    return [];
  }

  const insights: ComparisonInsight[] = [];
  const overallInsight = buildOverallShiftInsight(baselineSession, latestSession, t);
  const biggestSwingInsight = buildBiggestSwingInsight(criteriaTrendRows, t);
  const currentFocusInsight = buildCurrentFocusInsight(latestSession, t);

  if (overallInsight) {
    insights.push(overallInsight);
  }

  if (biggestSwingInsight) {
    insights.push(biggestSwingInsight);
  }

  if (currentFocusInsight) {
    insights.push(currentFocusInsight);
  }

  return insights;
}

function buildOverallShiftInsight(
  baselineSession: ComparableSession,
  latestSession: ComparableSession,
  t: TranslationFn,
) {
  const baselineOverall = resolveComparableOverallScore(baselineSession);
  const latestOverall = resolveComparableOverallScore(latestSession);
  if (typeof baselineOverall !== 'number' || typeof latestOverall !== 'number') {
    return null;
  }

  const overallDelta = latestOverall - baselineOverall;
  return {
    title: t('sessionComparison:insights.overallShift.title'),
    value: formatSignedWhole(overallDelta),
    body: t('sessionComparison:insights.overallShift.body', {
      from: Math.round(baselineOverall),
      to: Math.round(latestOverall),
    }),
  } satisfies ComparisonInsight;
}

function buildBiggestSwingInsight(criteriaTrendRows: CriteriaTrendRow[], t: TranslationFn) {
  const largestGain = criteriaTrendRows
    .map((row) => ({
      key: row.key,
      delta:
        row.baselineScore !== null && row.latestScore !== null
          ? row.latestScore - row.baselineScore
          : null,
    }))
    .filter(
      (row): row is { key: SessionComparisonDimensionKey; delta: number } =>
        typeof row.delta === 'number',
    )
    .sort((left, right) => right.delta - left.delta)[0];

  if (!largestGain) {
    return null;
  }

  return {
    title: t('sessionComparison:insights.biggestSwing.title'),
    value: t(`feedback:dimensions.${largestGain.key}.title`),
    body: t('sessionComparison:insights.biggestSwing.body', {
      delta: formatSignedWhole(largestGain.delta),
    }),
  } satisfies ComparisonInsight;
}

function buildCurrentFocusInsight(latestSession: ComparableSession, t: TranslationFn) {
  const latestWeakest = SESSION_COMPARISON_DIMENSION_KEYS.map((key) => ({
    key,
    score: resolveComparisonDimensionScore(latestSession.report, key),
  }))
    .filter(
      (row): row is { key: SessionComparisonDimensionKey; score: number } =>
        typeof row.score === 'number',
    )
    .sort((left, right) => left.score - right.score)[0];

  if (!latestWeakest) {
    return null;
  }

  return {
    title: t('sessionComparison:insights.currentFocus.title'),
    value: t(`feedback:dimensions.${latestWeakest.key}.title`),
    body: t('sessionComparison:insights.currentFocus.body', {
      score: Math.round(latestWeakest.score),
    }),
  } satisfies ComparisonInsight;
}

function buildHoverDetails(
  chronologicalSessions: ComparableSession[],
  hoveredSessionId: string | null,
  t: TranslationFn,
) {
  const targetSessionId = hoveredSessionId ?? chronologicalSessions.at(-1)?.sessionId ?? null;
  const session = chronologicalSessions.find((item) => item.sessionId === targetSessionId);
  if (!session) {
    return null;
  }

  const testCaseSummary = summarizeTestCaseBreakdown(session.report);
  return {
    sessionId: session.sessionId,
    title: session.session.problemTitle ?? t('sessionComparison:fallbackProblem'),
    timestamp: formatSessionDateTime(session.session.finishedAt ?? session.session.createdAt),
    overallScore: resolveComparableOverallScore(session),
    dimensionScores: SESSION_COMPARISON_DIMENSION_KEYS.map((key) => ({
      key,
      score: resolveComparisonDimensionScore(session.report, key),
    })),
    testCasePassed: testCaseSummary.passed,
    testCaseTotal: testCaseSummary.total,
  } satisfies HoverDetails;
}

function buildTestCaseSummaries(chronologicalSessions: ComparableSession[], t: TranslationFn) {
  return chronologicalSessions.map((item, index) => ({
    sessionId: item.sessionId,
    problemTitle: item.session.problemTitle ?? t('sessionComparison:fallbackProblem'),
    timestamp: item.session.finishedAt ?? item.session.createdAt,
    progressionLabel: resolveProgressionLabelKey(index, chronologicalSessions.length),
    summary: summarizeTestCaseBreakdown(item.report),
  }));
}

function syncSelectionSearch(navigate: NavigateFn, selectedSessionIds: string[]) {
  navigate({
    to: '.',
    search: (current) => ({
      ...current,
      ids: serializeSessionComparisonIds(selectedSessionIds),
    }),
    replace: true,
  }).catch(() => undefined);
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
