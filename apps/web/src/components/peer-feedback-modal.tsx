import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  cn,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@syncode/ui';
import { Loader2, MessageSquareText } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SessionFeedbackProgressTarget } from '@/lib/session-feedback-progress.js';

export interface PeerFeedbackModalTarget extends SessionFeedbackProgressTarget {}

interface PeerFeedbackModalProps {
  open: boolean;
  isLoading: boolean;
  isSubmitting: boolean;
  errorMessage: string | null;
  targets: PeerFeedbackModalTarget[];
  activeCandidateId: string | null;
  onActiveCandidateIdChange: (candidateId: string) => void;
  onSubmit: (candidateId: string, feedbackText: string) => void | Promise<void>;
  onSkip: (candidateId: string) => void | Promise<void>;
  onSkipAll: () => void | Promise<void>;
}

export function PeerFeedbackModal({
  open,
  isLoading,
  isSubmitting,
  errorMessage,
  targets,
  activeCandidateId,
  onActiveCandidateIdChange,
  onSubmit,
  onSkip,
  onSkipAll,
}: PeerFeedbackModalProps) {
  const { t } = useTranslation('feedback');
  const [draft, setDraft] = useState<{ candidateId: string | null; text: string }>({
    candidateId: null,
    text: '',
  });

  const activeTarget = useMemo(
    () => targets.find((target) => target.candidateId === activeCandidateId) ?? targets[0] ?? null,
    [activeCandidateId, targets],
  );
  const activeTargetId = activeTarget?.candidateId ?? null;
  const pendingCount = targets.filter((target) => target.state === 'pending').length;
  const feedbackText = draft.candidateId === activeTargetId ? draft.text : '';

  return (
    <Dialog.Root open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-1.5rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-[28px] bg-card p-5 shadow-[0_28px_80px_-32px_oklch(0.12_0.02_260/0.7)] ring-1 ring-border/60 sm:w-[calc(100vw-2rem)] sm:p-6">
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/55 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                <MessageSquareText className="size-3.5 text-primary" />
                {t('modal.eyebrow')}
              </div>
              <Dialog.Title className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {t('modal.title')}
              </Dialog.Title>
              <Dialog.Description className="max-w-xl text-sm leading-6 text-muted-foreground">
                {t('modal.description')}
              </Dialog.Description>
            </div>

            {isLoading ? (
              <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-3xl border border-border/50 bg-background/50 px-6 py-8 text-center">
                <Loader2 className="size-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">{t('modal.loading')}</p>
              </div>
            ) : activeTarget ? (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="rounded-3xl border border-border/50 bg-background/55 p-4">
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      {t('modal.currentTargetLabel')}
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <Avatar className="size-11">
                        {activeTarget.candidateAvatarUrl ? (
                          <AvatarImage src={activeTarget.candidateAvatarUrl} alt="" />
                        ) : null}
                        <AvatarFallback>
                          {getNameInitial(activeTarget.candidateName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground sm:text-base">
                          {activeTarget.candidateName}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                          {t(`role.${activeTarget.role}`)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-border/50 bg-background/45 p-4">
                    <Label
                      htmlFor="peer-feedback-target"
                      className="text-xs uppercase tracking-[0.12em] text-muted-foreground"
                    >
                      {t('modal.selectorLabel')}
                    </Label>
                    <Select
                      value={activeTarget.candidateId}
                      onValueChange={onActiveCandidateIdChange}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger
                        id="peer-feedback-target"
                        className="mt-3 border-border/70 bg-background/80"
                      >
                        <SelectValue placeholder={t('modal.selectorPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {targets.map((target) => (
                          <SelectItem value={target.candidateId} key={target.candidateId}>
                            {target.candidateName} {formatTargetState(t, target.state)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="mt-3 text-xs leading-5 text-muted-foreground">
                      {t('modal.progress', {
                        current: Math.max(
                          1,
                          targets.findIndex(
                            (target) => target.candidateId === activeTarget.candidateId,
                          ) + 1,
                        ),
                        total: targets.length,
                        pending: pendingCount,
                      })}
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <Label htmlFor="peer-feedback-text">{t('modal.feedbackLabel')}</Label>
                  <textarea
                    id="peer-feedback-text"
                    value={feedbackText}
                    onChange={(event) =>
                      setDraft({ candidateId: activeTargetId, text: event.target.value })
                    }
                    rows={7}
                    disabled={isSubmitting}
                    placeholder={t('modal.feedbackPlaceholder')}
                    className="min-h-36 flex w-full rounded-3xl border border-border/70 bg-background/55 px-4 py-3 text-sm text-foreground shadow-xs outline-none transition-colors placeholder:text-muted-foreground/75 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/15"
                  />
                  <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <p>{t('modal.feedbackHint')}</p>
                    <p>
                      {t('modal.characterCount', { count: feedbackText.trim().length, max: 2000 })}
                    </p>
                  </div>
                  {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-border/50 bg-background/50 px-6 py-8 text-center">
                <p className="text-sm text-muted-foreground">{t('modal.empty')}</p>
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="destructive"
                disabled={isLoading || isSubmitting || targets.length === 0}
                onClick={() => void onSkipAll()}
              >
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                {t('modal.skipAll')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={isLoading || isSubmitting || !activeTarget}
                onClick={() => (activeTarget ? void onSkip(activeTarget.candidateId) : undefined)}
              >
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                {t('modal.skip')}
              </Button>
              <Button
                type="button"
                disabled={
                  isLoading ||
                  isSubmitting ||
                  !activeTarget ||
                  feedbackText.trim().length === 0 ||
                  feedbackText.trim().length > 2000
                }
                className={cn(
                  'bg-cyan-500 text-slate-950 hover:bg-cyan-400',
                  'disabled:bg-cyan-500/50 disabled:text-slate-950/70',
                )}
                onClick={() =>
                  activeTarget ? void onSubmit(activeTarget.candidateId, feedbackText) : undefined
                }
              >
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                {t('modal.submit')}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function getNameInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || '?';
}

function formatTargetState(t: (key: string) => string, state: PeerFeedbackModalTarget['state']) {
  if (state === 'pending') {
    return `(${t('modal.state.pending')})`;
  }

  if (state === 'submitted') {
    return `(${t('modal.state.submitted')})`;
  }

  return `(${t('modal.state.skipped')})`;
}
