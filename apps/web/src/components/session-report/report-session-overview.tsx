import type { SessionDetail } from '@syncode/contracts';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@syncode/ui';
import {
  Bot,
  CalendarClock,
  CircleCheckBig,
  CircleDashed,
  Clock3,
  Code2,
  MessageSquareText,
  MonitorPlay,
  Radio,
  Send,
  Sparkles,
  UsersRound,
  Video,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  formatSessionDateTime,
  formatSessionDuration,
  resolveSessionDurationSeconds,
} from '@/lib/dashboard-session-history.js';

type ReportStatus = 'pending' | 'ready' | 'unavailable';

export function ReportSessionOverview({
  session,
  currentUserId,
  reportStatus,
  reportGeneratedAt,
}: {
  session: SessionDetail;
  currentUserId: string | null;
  reportStatus: ReportStatus;
  reportGeneratedAt: string | undefined;
}) {
  const { t } = useTranslation('feedback');
  const durationSeconds = resolveSessionDurationSeconds(
    session.createdAt,
    session.finishedAt,
    session.duration,
  );

  return (
    <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
      <CardHeader className="px-5 pt-6 pb-4 sm:px-6">
        <CardTitle className="flex items-center gap-2">
          <UsersRound className="size-4 text-primary" />
          <span>{t('details.heading')}</span>
        </CardTitle>
        <CardDescription>{t('details.description')}</CardDescription>
      </CardHeader>
      <CardContent className="px-5 pb-6 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <OverviewStat
                label={t('details.mode')}
                value={t(`mode.${session.mode}`)}
                icon={<MonitorPlay className="size-4 text-primary" />}
              />
              <OverviewStat
                label={t('details.language')}
                value={session.language ?? t('details.unknown')}
                icon={<Code2 className="size-4 text-primary" />}
              />
              <OverviewStat
                label={t('details.difficulty')}
                value={session.problem?.difficulty ?? t('details.unknown')}
                icon={<Sparkles className="size-4 text-primary" />}
              />
              <OverviewStat
                label={t('details.duration')}
                value={formatSessionDuration(durationSeconds)}
                icon={<Clock3 className="size-4 text-primary" />}
              />
              <OverviewStat
                label={t('details.date')}
                value={formatSessionDateTime(session.finishedAt ?? session.createdAt)}
                icon={<CalendarClock className="size-4 text-primary" />}
              />
              <OverviewStat
                label={t('details.generatedAt')}
                value={
                  reportGeneratedAt
                    ? formatSessionDateTime(reportGeneratedAt)
                    : reportStatus === 'pending'
                      ? t('details.pending')
                      : t('details.unknown')
                }
                icon={<Bot className="size-4 text-primary" />}
              />
            </div>

            <div className="rounded-2xl bg-muted/35 p-4 ring-1 ring-border/50">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {t('details.activity')}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                <ActivityStat
                  icon={<Radio className="size-4 text-primary" />}
                  label={t('details.runs')}
                  value={String(session.runs.length)}
                />
                <ActivityStat
                  icon={<Send className="size-4 text-primary" />}
                  label={t('details.submissions')}
                  value={String(session.submissions.length)}
                />
                <ActivityStatusStat
                  icon={<Bot className="size-4" />}
                  label={t('details.report')}
                  status={reportStatus}
                  readyText={t('details.available')}
                  pendingText={t('details.pending')}
                  unavailableText={t('details.unavailable')}
                />
                <ActivityStatusStat
                  icon={<MessageSquareText className="size-4" />}
                  label={t('details.feedbackStatus')}
                  status={session.hasFeedback ? 'ready' : 'unavailable'}
                  readyText={t('details.available')}
                  pendingText={t('details.pending')}
                  unavailableText={t('details.unavailable')}
                />
                <ActivityStatusStat
                  icon={<Video className="size-4" />}
                  label={t('details.recording')}
                  status={session.hasRecording ? 'ready' : 'unavailable'}
                  readyText={t('details.available')}
                  pendingText={t('details.pending')}
                  unavailableText={t('details.unavailable')}
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-muted/35 p-4 ring-1 ring-border/50">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {t('participants.heading')}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('participants.description', { count: session.participants.length })}
                </p>
              </div>
              <Badge size="sm" variant="neutral">
                {session.participants.length}
              </Badge>
            </div>

            <ul className="mt-4 space-y-3">
              {session.participants.map((participant) => {
                const displayName = participant.displayName ?? participant.username;
                const initials = getInitials(displayName);
                const isCurrentUser = currentUserId === participant.userId;

                return (
                  <li
                    key={participant.userId}
                    className="flex items-start gap-3 rounded-2xl bg-background/60 px-3 py-3"
                  >
                    <Avatar className="size-10 shrink-0">
                      {participant.avatarUrl ? <AvatarImage src={participant.avatarUrl} /> : null}
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {displayName}
                        </p>
                        <Badge size="sm" variant={getParticipantBadgeVariant(participant.role)}>
                          {t(`role.${participant.role}`)}
                        </Badge>
                        {isCurrentUser ? (
                          <Badge size="sm" variant="outline">
                            {t('participants.you')}
                          </Badge>
                        ) : null}
                      </div>

                      <p className="mt-1 text-xs text-muted-foreground">@{participant.username}</p>

                      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                        <p>
                          {t('participants.joinedAt')}:{' '}
                          {formatSessionDateTime(participant.joinedAt)}
                        </p>
                        <p>
                          {t('participants.leftAt')}:{' '}
                          {participant.leftAt
                            ? formatSessionDateTime(participant.leftAt)
                            : t('participants.leftAtMissing')}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewStat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-2xl bg-muted/35 p-4 ring-1 ring-border/50">
      <div className="flex items-center gap-2">{icon}</div>
      <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium leading-6 text-foreground">{value}</p>
    </div>
  );
}

function ActivityStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-background/50 px-3 py-2.5 ring-1 ring-border/40">
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold tabular-nums text-foreground">{value}</p>
      </div>
    </div>
  );
}

function ActivityStatusStat({
  icon: _icon,
  label,
  status,
  readyText,
  pendingText,
  unavailableText,
}: {
  icon: ReactNode;
  label: string;
  status: ReportStatus;
  readyText: string;
  pendingText: string;
  unavailableText: string;
}) {
  const valueText =
    status === 'ready' ? readyText : status === 'pending' ? pendingText : unavailableText;
  const isReady = status === 'ready';
  const isPending = status === 'pending';

  return (
    <div className="flex items-center gap-3 rounded-xl bg-background/50 px-3 py-2.5 ring-1 ring-border/40">
      <span
        className={
          isReady
            ? 'shrink-0 text-emerald-400'
            : isPending
              ? 'shrink-0 text-amber-400'
              : 'shrink-0 text-muted-foreground/50'
        }
      >
        {isReady ? (
          <CircleCheckBig className="size-4" />
        ) : isPending ? (
          icon
        ) : (
          <CircleDashed className="size-4" />
        )}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] text-muted-foreground">{label}</p>
        <p
          className={`text-sm font-medium ${isReady ? 'text-emerald-400' : isPending ? 'text-amber-400' : 'text-muted-foreground/60'}`}
        >
          {valueText}
        </p>
      </div>
    </div>
  );
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '??';
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function getParticipantBadgeVariant(role: SessionDetail['participants'][number]['role']) {
  if (role === 'candidate') {
    return 'candidate';
  }

  if (role === 'interviewer') {
    return 'interviewer';
  }

  return 'observer';
}
