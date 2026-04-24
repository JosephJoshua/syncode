import { Button } from '@syncode/ui';
import { MessageSquareQuote } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type {
  FeedbackUser,
  GetSessionFeedbackResponse,
  PeerFeedbackEntry,
} from '@/lib/session-peer-feedback.js';
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
  const shouldShowEntries = feedback?.allSubmitted !== false && entries.length > 0;

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
          <div className="h-4 w-40 animate-pulse rounded bg-muted/40" />
          <div className="h-4 w-64 animate-pulse rounded bg-muted/30" />
          <div className="h-24 animate-pulse rounded-2xl bg-muted/30" />
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
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl bg-muted/35 p-4 ring-1 ring-border/50">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {t('peerFeedbackSection.statusHeading')}
            </p>
            <p className="mt-3 font-mono text-sm text-foreground">
              allSubmitted: {String(feedback?.allSubmitted ?? false)}
            </p>
            {feedback?.allSubmitted === false ? (
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {t('peerFeedbackSection.hiddenUntilSubmitted')}
              </p>
            ) : null}
          </div>

          {shouldShowEntries ? (
            <div className="space-y-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {t('peerFeedbackSection.entriesHeading')}
              </p>

              {entries.map((entry, index) => (
                <PeerFeedbackPlaceholderEntry key={entry.feedbackId} entry={entry} index={index} />
              ))}
            </div>
          ) : feedback?.allSubmitted === true ? (
            <p className="text-sm leading-6 text-muted-foreground">
              {t('peerFeedbackSection.empty')}
            </p>
          ) : null}
        </div>
      )}
    </SectionCard>
  );
}

function PeerFeedbackPlaceholderEntry({
  entry,
  index,
}: {
  entry: PeerFeedbackEntry;
  index: number;
}) {
  const { t } = useTranslation('feedback');

  return (
    <div className="rounded-2xl bg-muted/35 p-4 ring-1 ring-border/50">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {t('peerFeedbackSection.entryLabel', { index: index + 1 })}
      </p>

      <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
        <PlaceholderField label="feedbackId" value={entry.feedbackId} />
        <PlaceholderField
          label="fromUser"
          value={formatFeedbackUser(entry.fromUser, t('peerFeedbackSection.noDisplayName'))}
        />
        <PlaceholderField
          label="targetUser"
          value={formatFeedbackUser(entry.targetUser, t('peerFeedbackSection.noDisplayName'))}
        />

        <div className="space-y-2">
          <p className="font-mono text-xs text-foreground">ratings</p>
          <div className="rounded-xl bg-background/60 px-3 py-3">
            <div className="space-y-1 font-mono text-xs text-muted-foreground">
              <p>problemSolving: {entry.ratings.problemSolving}</p>
              <p>communication: {entry.ratings.communication}</p>
              <p>codeQuality: {entry.ratings.codeQuality}</p>
              <p>debugging: {entry.ratings.debugging}</p>
              <p>overall: {entry.ratings.overall}</p>
            </div>
          </div>
        </div>

        <PlaceholderField label="strengths" value={entry.strengths} />
        <PlaceholderField label="improvements" value={entry.improvements} />
        <PlaceholderField label="wouldPairAgain" value={String(entry.wouldPairAgain)} />
        <PlaceholderField label="submittedAt" value={entry.submittedAt} />
      </div>
    </div>
  );
}

function PlaceholderField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-2">
      <p className="font-mono text-xs text-foreground">{label}</p>
      <div className="rounded-xl bg-background/60 px-3 py-3">
        <p className="break-words font-mono text-xs text-muted-foreground">{value}</p>
      </div>
    </div>
  );
}

function formatFeedbackUser(user: FeedbackUser, fallbackDisplayName: string) {
  return `${user.displayName ?? fallbackDisplayName} / ${user.username} / ${user.id}`;
}
