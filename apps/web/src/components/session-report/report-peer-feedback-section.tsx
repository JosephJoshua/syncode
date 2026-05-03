import { Avatar, AvatarFallback, AvatarImage, Badge, Button } from '@syncode/ui';
import { MessageSquareQuote } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatSessionDateTime } from '@/lib/dashboard-session-history.js';
import type { GetSessionFeedbackResponse, PeerFeedbackEntry } from '@/lib/session-peer-feedback.js';
import { SectionCard } from './report-feedback-shell.js';

export function ReportPeerFeedbackSection({
  feedback,
  isLoading,
  isError,
  onRetry,
}: {
  feedback: GetSessionFeedbackResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation('feedback');
  const entries = feedback?.data ?? [];

  return (
    <SectionCard
      title={t('sections.peerFeedbackSection')}
      description={t('sections.peerFeedbackSectionDescription')}
      icon={<MessageSquareQuote className="size-4 text-primary" />}
    >
      {isLoading ? (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-muted-foreground">
            {t('peerFeedbackSection.loading')}
          </p>
          <div className="space-y-3 rounded-2xl bg-muted/35 p-4 ring-1 ring-border/50">
            <div className="h-5 w-40 animate-pulse rounded-full bg-muted/40" />
            <div className="h-4 w-64 animate-pulse rounded bg-muted/30" />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="h-12 animate-pulse rounded-xl bg-background/60" />
              <div className="h-12 animate-pulse rounded-xl bg-background/60" />
            </div>
            <div className="h-28 animate-pulse rounded-2xl bg-background/60" />
          </div>
        </div>
      ) : isError ? (
        <div>
          <p className="text-sm leading-6 text-muted-foreground">
            {t('peerFeedbackSection.error')}
          </p>
          <Button className="mt-5" variant="outline" onClick={onRetry}>
            {t('peerFeedbackSection.retry')}
          </Button>
        </div>
      ) : feedback?.allSubmitted === false ? (
        <div className="rounded-2xl bg-muted/35 p-4 ring-1 ring-border/50">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {t('peerFeedbackSection.statusHeading')}
          </p>
          <p className="mt-3 text-sm font-medium text-foreground">
            {t('peerFeedbackSection.awaitingResponses')}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t('peerFeedbackSection.hiddenUntilSubmitted')}
          </p>
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm leading-6 text-muted-foreground">{t('peerFeedbackSection.empty')}</p>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <PeerFeedbackEntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function PeerFeedbackEntryCard({ entry }: { entry: PeerFeedbackEntry }) {
  const { t } = useTranslation('feedback');
  const fromUserName = entry.reviewerName;
  const targetUserName = entry.candidateName;

  return (
    <article className="rounded-2xl bg-muted/35 p-4 ring-1 ring-border/50 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <Avatar className="size-10 shrink-0">
            {entry.reviewerAvatarUrl ? <AvatarImage src={entry.reviewerAvatarUrl} /> : null}
            <AvatarFallback>{getFeedbackUserInitial(entry.reviewerName)}</AvatarFallback>
          </Avatar>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground sm:text-base">
                {fromUserName} {'\u2192'} {targetUserName}
              </p>
              <Badge size="sm" variant={getPairAgainBadgeVariant(entry.wouldPairAgain)}>
                {entry.wouldPairAgain
                  ? t('peerFeedbackSection.wouldPairAgain')
                  : t('peerFeedbackSection.wouldNotPairAgain')}
              </Badge>
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              {t('peerFeedbackSection.feedbackFrom', { name: fromUserName })}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 lg:pl-4">
          <Badge size="sm" variant="outline">
            {t('peerFeedbackSection.submittedAt')}
          </Badge>
          <p className="text-sm text-muted-foreground">
            {formatFeedbackTimestamp(entry.createdAt)}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2 lg:items-center">
        <div className="lg:w-fit">
          <div data-slot="peer-feedback-ratings-layout" className="space-y-3">
            <RatingRow
              label={t('peerFeedbackSection.ratings.problemSolving')}
              score={entry.problemSolvingRating}
            />
            <RatingRow
              label={t('peerFeedbackSection.ratings.communication')}
              score={entry.communicationRating}
            />
            <RatingRow
              label={t('peerFeedbackSection.ratings.codeQuality')}
              score={entry.codeQualityRating}
            />
            <RatingRow
              label={t('peerFeedbackSection.ratings.debugging')}
              score={entry.debuggingRating}
            />
          </div>
        </div>

        <div className="lg:flex lg:justify-start">
          <div
            data-slot="peer-feedback-summary-panel"
            className="rounded-xl border border-border/50 bg-background/40 px-5 py-5 lg:w-full"
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {t('peerFeedbackSection.summaryPanel')}
            </p>
            <div className="mt-4 border-t border-border/40 pt-4 pl-4">
              <p className="mt-1 ml-5 font-mono text-4xl font-semibold text-foreground">
                {entry.overallRating}/5
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <WrittenFeedbackBlock title={t('peerFeedbackSection.strengths')} body={entry.strengths} />
        <WrittenFeedbackBlock
          title={t('peerFeedbackSection.improvements')}
          body={entry.improvements}
        />
      </div>
    </article>
  );
}

function RatingRow({ label, score }: { label: string; score: number }) {
  return (
    <div data-slot="peer-feedback-rating-row" className="space-y-2">
      <div className="space-y-2 sm:grid sm:grid-cols-[minmax(0,150px)_264px_3rem] sm:items-center sm:gap-3 sm:space-y-0">
        <span className="text-sm text-foreground">{label}</span>
        <div className="flex items-center gap-3 sm:contents">
          <SegmentedRatingBar label={label} score={score} />
          <span className="w-12 shrink-0 text-right font-mono text-xs text-muted-foreground">
            {score}/5
          </span>
        </div>
      </div>
    </div>
  );
}

function SegmentedRatingBar({ label, score }: { label: string; score: number }) {
  return (
    <div
      data-slot="peer-feedback-rating-bar"
      role="img"
      aria-label={`${label}: ${score}/5`}
      className="flex w-[264px] max-w-full items-center gap-1"
    >
      {Array.from({ length: 5 }, (_, index) => {
        const isFilled = index < score;

        return (
          <span
            key={`${label}-${index + 1}`}
            data-slot="peer-feedback-rating-segment"
            data-filled={isFilled ? 'true' : 'false'}
            className={
              isFilled
                ? 'h-3 flex-1 rounded-sm bg-primary'
                : 'h-3 flex-1 rounded-sm bg-background/70 ring-1 ring-inset ring-border/50'
            }
          />
        );
      })}
    </div>
  );
}

function _SummarySeparator() {
  return (
    <span aria-hidden className="text-sm text-muted-foreground/60">
      •
    </span>
  );
}

function WrittenFeedbackBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl bg-background/60 px-4 py-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}

function getFeedbackUserInitial(name: string) {
  const source = name.trim();
  return source.charAt(0).toUpperCase() || '?';
}

function getPairAgainBadgeVariant(wouldPairAgain: boolean) {
  return wouldPairAgain ? 'success' : 'warning';
}

function formatFeedbackTimestamp(createdAt: string) {
  return formatSessionDateTime(createdAt);
}
