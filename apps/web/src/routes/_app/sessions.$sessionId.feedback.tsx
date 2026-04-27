import { Button } from '@syncode/ui';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AiFeedbackMarkdown } from '@/components/session-report/ai-feedback-rich-text.js';
import {
  CompactInsightCard,
  SummaryList,
} from '@/components/session-report/report-ai-review-sections.js';
import { ReportDimensionCard } from '@/components/session-report/report-dimension-card.js';
import { getDimensionIcon } from '@/components/session-report/report-dimension-icon.js';
import { FeedbackShell, SectionCard } from '@/components/session-report/report-feedback-shell.js';
import { FinalCodeSection } from '@/components/session-report/report-final-code-section.js';
import { buildHeaderBadges } from '@/components/session-report/report-header-badges.js';
import { ReportPageSkeleton } from '@/components/session-report/report-page-skeleton.js';
import { ReportPeerFeedbackSection } from '@/components/session-report/report-peer-feedback-section.js';
import { ReportPendingState } from '@/components/session-report/report-pending-state.js';
import { ReportScoreSummary } from '@/components/session-report/report-score-summary.js';
import { ReportSessionOverview } from '@/components/session-report/report-session-overview.js';
import { ReportSessionTimeline } from '@/components/session-report/report-session-timeline.js';
import { ReportSnapshotHistory } from '@/components/session-report/report-snapshot-history.js';
import { ReportTestCaseList } from '@/components/session-report/report-test-case-list.js';
import {
  formatSessionDateTime,
  resolveSessionDurationSeconds,
} from '@/lib/dashboard-session-history.js';
import { fetchSessionDetail } from '@/lib/session-detail.js';
import {
  getDetailedFeedbackPreview,
  getDimensionEntries,
  getMostRecentSnapshot,
  getViewerRole,
  toSupportedLanguage,
} from '@/lib/session-feedback.js';
import { fetchSessionPeerFeedback } from '@/lib/session-peer-feedback.js';
import { fetchSessionReport } from '@/lib/session-report.js';
import { fetchSessionSnapshots } from '@/lib/session-snapshots.js';
import { useAuthStore } from '@/stores/auth.store.js';

export const Route = createFileRoute('/_app/sessions/$sessionId/feedback')({
  component: SessionFeedbackPage,
});

function SessionFeedbackPage() {
  const { t } = useTranslation('feedback');
  const { sessionId } = Route.useParams();
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  const [isFullReviewVisible, setIsFullReviewVisible] = useState(false);

  const sessionQuery = useQuery({
    queryKey: ['sessions', sessionId, 'detail'],
    queryFn: () => fetchSessionDetail(sessionId),
    retry: false,
  });

  const reportQuery = useQuery({
    queryKey: ['sessions', sessionId, 'report'],
    queryFn: () => fetchSessionReport(sessionId),
    retry: false,
    refetchInterval: (query) => (query.state.data?.state === 'pending' ? 10_000 : false),
    refetchIntervalInBackground: true,
  });

  const snapshotsQuery = useQuery({
    queryKey: ['sessions', sessionId, 'snapshots'],
    queryFn: () => fetchSessionSnapshots(sessionId),
    retry: false,
  });

  const peerFeedbackQuery = useQuery({
    queryKey: ['sessions', sessionId, 'peer-feedback'],
    queryFn: () => fetchSessionPeerFeedback(sessionId),
    retry: false,
  });

  const session = sessionQuery.data;
  const reportState = reportQuery.data;
  const report = reportState?.state === 'ready' ? reportState.report : null;
  const viewerRole = getViewerRole(session, currentUserId);
  const durationSeconds = session
    ? resolveSessionDurationSeconds(session.createdAt, session.finishedAt, session.duration)
    : 0;
  const reportLanguage = toSupportedLanguage(session?.language);
  const dimensionEntries = getDimensionEntries(report);
  const latestSnapshot = getMostRecentSnapshot(snapshotsQuery.data ?? []);
  const feedbackPreview = report?.detailedFeedback
    ? getDetailedFeedbackPreview(report.detailedFeedback)
    : null;
  const canExpandFeedback = Boolean(
    report?.detailedFeedback &&
      feedbackPreview &&
      feedbackPreview.trim() !== report.detailedFeedback.trim(),
  );

  useEffect(() => {
    if (sessionId) {
      setIsFullReviewVisible(false);
    }
  }, [sessionId]);

  const snapshotSection = (
    <ReportSnapshotHistory
      snapshots={snapshotsQuery.data ?? []}
      isLoading={snapshotsQuery.isLoading}
      isError={snapshotsQuery.isError}
      onRetry={() => void snapshotsQuery.refetch()}
    />
  );

  if (sessionQuery.isLoading || (reportQuery.isLoading && !reportQuery.data)) {
    return <ReportPageSkeleton />;
  }

  if (!session || sessionQuery.isError) {
    return (
      <FeedbackShell
        title={t('heading')}
        eyebrow={t('eyebrow')}
        metaLine={t('notFound.description')}
        badges={[]}
      >
        <SectionCard title={t('heading')} description={t('notFound.description')}>
          <p className="text-sm leading-6 text-muted-foreground">
            {t('notFound.invalidSessionId', { sessionId })}
          </p>
          <Button className="mt-5" variant="outline" onClick={() => void sessionQuery.refetch()}>
            {t('actions.retrySession')}
          </Button>
        </SectionCard>
      </FeedbackShell>
    );
  }

  const badges = buildHeaderBadges(t, viewerRole, report, durationSeconds);

  if (reportQuery.isError) {
    return (
      <FeedbackShell
        title={session.problem?.title ?? t('fallbackProblemTitle')}
        eyebrow={t('eyebrow')}
        metaLine={formatSessionDateTime(session.finishedAt ?? session.createdAt)}
        badges={badges}
        sessionId={session.sessionId}
      >
        <div className="space-y-6">
          <ReportSessionOverview
            session={session}
            currentUserId={currentUserId}
            reportStatus="unavailable"
            reportGeneratedAt={undefined}
          />
          <ReportPeerFeedbackSection
            feedback={peerFeedbackQuery.data}
            isLoading={peerFeedbackQuery.isLoading}
            isError={peerFeedbackQuery.isError}
            onRetry={() => void peerFeedbackQuery.refetch()}
          />

          <SectionCard title={t('error.title')} description={t('error.description')}>
            <p className="text-sm leading-6 text-muted-foreground">{t('error.body')}</p>
            <Button className="mt-5" variant="outline" onClick={() => void reportQuery.refetch()}>
              {t('actions.retryReport')}
            </Button>
          </SectionCard>
          <FinalCodeSection
            snapshot={latestSnapshot}
            isLoading={snapshotsQuery.isLoading}
            isError={snapshotsQuery.isError}
            onRetry={() => void snapshotsQuery.refetch()}
          />
          {snapshotSection}
        </div>
      </FeedbackShell>
    );
  }

  return (
    <FeedbackShell
      title={session.problem?.title ?? t('fallbackProblemTitle')}
      eyebrow={t('eyebrow')}
      metaLine={formatSessionDateTime(session.finishedAt ?? session.createdAt)}
      badges={badges}
      sessionId={session.sessionId}
    >
      <div className="space-y-6">
        {reportState?.state === 'pending' ? (
          <ReportPendingState
            title={t('pending.title')}
            subtitle={t('pending.subtitle')}
            body={t('pending.body')}
            pollingLabel={t('pending.polling')}
          />
        ) : report ? (
          <ReportScoreSummary
            overallScore={report.overallScore}
            items={dimensionEntries.map(([key, dimension]) => ({
              key,
              label: t(`dimensions.${key}.title`),
              score: dimension.score,
            }))}
          />
        ) : null}

        <ReportSessionOverview
          session={session}
          currentUserId={currentUserId}
          reportStatus={
            reportState?.state === 'pending' ? 'pending' : report ? 'ready' : 'unavailable'
          }
          reportGeneratedAt={report?.generatedAt}
        />

        <ReportPeerFeedbackSection
          feedback={peerFeedbackQuery.data}
          isLoading={peerFeedbackQuery.isLoading}
          isError={peerFeedbackQuery.isError}
          onRetry={() => void peerFeedbackQuery.refetch()}
        />

        <FinalCodeSection
          snapshot={latestSnapshot}
          isLoading={snapshotsQuery.isLoading}
          isError={snapshotsQuery.isError}
          onRetry={() => void snapshotsQuery.refetch()}
        />

        {report ? (
          <SectionCard
            title={t('sections.aiReview')}
            description={t('sections.aiReviewDescription')}
            icon={<Sparkles className="size-4 text-primary" />}
          >
            <div className="space-y-6">
              {report.strengths?.length || report.areasForImprovement?.length ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <SummaryList title={t('sections.strengths')} items={report.strengths ?? []} />
                  <SummaryList
                    title={t('sections.areasForImprovement')}
                    items={report.areasForImprovement ?? []}
                  />
                </div>
              ) : null}

              {report.detailedFeedback && feedbackPreview ? (
                <div className="prose prose-sm max-w-none text-muted-foreground prose-headings:text-foreground prose-p:leading-7 prose-strong:text-foreground prose-li:text-muted-foreground">
                  <AiFeedbackMarkdown
                    markdown={isFullReviewVisible ? report.detailedFeedback : feedbackPreview}
                  />
                </div>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">
                  {t('sections.noDetailedFeedback')}
                </p>
              )}

              {canExpandFeedback ? (
                <Button
                  variant="ghost"
                  className="px-0 text-sm text-muted-foreground hover:bg-transparent hover:text-foreground"
                  onClick={() => setIsFullReviewVisible((current) => !current)}
                >
                  {isFullReviewVisible ? t('actions.showLessReview') : t('actions.showFullReview')}
                </Button>
              ) : null}

              {dimensionEntries.length > 0 ? (
                <div className="space-y-4">
                  {dimensionEntries.map(([key, dimension]) => (
                    <ReportDimensionCard
                      key={key}
                      title={t(`dimensions.${key}.title`)}
                      dimension={dimension}
                      language={reportLanguage}
                      icon={getDimensionIcon(key)}
                    />
                  ))}
                </div>
              ) : null}

              {report.comparisonToHistory || report.peerFeedbackSummary ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {report.comparisonToHistory ? (
                    <CompactInsightCard
                      title={t('sections.comparison')}
                      rows={[
                        [t('comparison.trend'), t(`trend.${report.comparisonToHistory.trend}`)],
                        [
                          t('comparison.sessionsCompared'),
                          String(report.comparisonToHistory.sessionsCompared),
                        ],
                        [
                          t('comparison.averageScore'),
                          String(Math.round(report.comparisonToHistory.averageScore)),
                        ],
                      ]}
                    />
                  ) : null}

                  {report.peerFeedbackSummary ? (
                    <CompactInsightCard
                      title={t('sections.peerFeedback')}
                      rows={[
                        [
                          t('peerFeedback.averageRating'),
                          String(report.peerFeedbackSummary.averageRating),
                        ],
                        [
                          t('peerFeedback.wouldPairAgain'),
                          `${Math.round(report.peerFeedbackSummary.wouldPairAgain)}%`,
                        ],
                        [
                          t('peerFeedback.themes'),
                          report.peerFeedbackSummary.themes.length > 0
                            ? report.peerFeedbackSummary.themes.join(', ')
                            : t('peerFeedback.none'),
                        ],
                      ]}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          </SectionCard>
        ) : null}

        {report ? (
          <SectionCard
            title={t('sections.testCaseBreakdown')}
            description={t('sections.testCaseBreakdownDescription')}
          >
            <ReportTestCaseList breakdown={report.testCaseBreakdown ?? []} />
          </SectionCard>
        ) : null}

        <ReportSessionTimeline
          startedAt={session.createdAt}
          finishedAt={session.finishedAt}
          snapshots={snapshotsQuery.data ?? []}
        />

        {snapshotSection}
      </div>
    </FeedbackShell>
  );
}
