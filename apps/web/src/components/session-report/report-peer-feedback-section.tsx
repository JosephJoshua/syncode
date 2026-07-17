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
  const content = renderPeerFeedbackContent({
    entries,
    feedback,
    isError,
    isLoading,
    onRetry,
    t,
  });

  return (
    <SectionCard
      title={t('sections.peerFeedbackSection')}
      description={t('sections.peerFeedbackSectionDescription')}
      icon={<MessageSquareQuote className="size-4 text-primary" />}
    >
      {content}
    </SectionCard>
  );
}

function renderPeerFeedbackContent({
  entries,
  feedback,
  isError,
  isLoading,
  onRetry,
  t,
}: {
  entries: PeerFeedbackEntry[];
  feedback: GetSessionFeedbackResponse | undefined;
  isError: boolean;
  isLoading: boolean;
  onRetry: () => void;
  t: (key: string) => string;
}) {
  if (isLoading) {
    return <PeerFeedbackLoadingState label={t('peerFeedbackSection.loading')} />;
  }

  if (isError) {
    return (
      <PeerFeedbackErrorState
        message={t('peerFeedbackSection.error')}
        onRetry={onRetry}
        retryLabel={t('peerFeedbackSection.retry')}
      />
    );
  }

  if (feedback?.allSubmitted === false && entries.length === 0) {
    return (
      <PeerFeedbackPendingNotice
        heading={t('peerFeedbackSection.statusHeading')}
        message={t('peerFeedbackSection.awaitingResponses')}
        detail={t('peerFeedbackSection.hiddenUntilSubmitted')}
      />
    );
  }

  if (entries.length > 0) {
    return (
      <div className="space-y-4">
        {feedback?.allSubmitted === false ? (
          <PeerFeedbackPendingNotice
            heading={t('peerFeedbackSection.statusHeading')}
            message={t('peerFeedbackSection.awaitingResponses')}
          />
        ) : null}
        {entries.map((entry) => (
          <PeerFeedbackEntryCard key={entry.id} entry={entry} />
        ))}
      </div>
    );
  }

  return (
    <p className="text-sm leading-6 text-muted-foreground">{t('peerFeedbackSection.empty')}</p>
  );
}

function PeerFeedbackLoadingState({ label }: { readonly label: string }) {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-muted-foreground">{label}</p>
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
  );
}

function PeerFeedbackErrorState({
  message,
  onRetry,
  retryLabel,
}: {
  readonly message: string;
  readonly onRetry: () => void;
  readonly retryLabel: string;
}) {
  return (
    <div>
      <p className="text-sm leading-6 text-muted-foreground">{message}</p>
      <Button className="mt-5" variant="outline" onClick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  );
}

function PeerFeedbackPendingNotice({
  detail,
  heading,
  message,
}: {
  readonly detail?: string;
  readonly heading: string;
  readonly message: string;
}) {
  return (
    <div className="rounded-2xl bg-muted/35 p-4 ring-1 ring-border/50">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {heading}
      </p>
      <p className="mt-3 text-sm font-medium text-foreground">{message}</p>
      {detail ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p> : null}
    </div>
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
          <Avatar className="size-10 shrink-0" aria-label={fromUserName} title={fromUserName}>
            {entry.reviewerAvatarUrl ? <AvatarImage src={entry.reviewerAvatarUrl} alt="" /> : null}
            <AvatarFallback>{getFeedbackUserInitial(entry.reviewerName)}</AvatarFallback>
          </Avatar>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground sm:text-base">
                {fromUserName} {'\u2192'} {targetUserName}
              </p>
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              {t('peerFeedbackSection.feedbackFrom', { name: fromUserName })}
            </p>
          </div>
        </div>

        <Avatar className="size-10 shrink-0" aria-label={targetUserName} title={targetUserName}>
          {entry.candidateAvatarUrl ? <AvatarImage src={entry.candidateAvatarUrl} alt="" /> : null}
          <AvatarFallback>{getFeedbackUserInitial(entry.candidateName)}</AvatarFallback>
        </Avatar>

        <div className="flex shrink-0 items-center gap-2 lg:pl-4">
          <Badge size="sm" variant="outline">
            {t('peerFeedbackSection.submittedAt')}
          </Badge>
          <p className="text-sm text-muted-foreground">
            {formatFeedbackTimestamp(entry.createdAt)}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <WrittenFeedbackBlock
          title={t('peerFeedbackSection.feedbackLabel')}
          body={entry.feedbackText}
        />
      </div>
    </article>
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

function formatFeedbackTimestamp(createdAt: string) {
  return formatSessionDateTime(createdAt);
}
