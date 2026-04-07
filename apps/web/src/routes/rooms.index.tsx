import { CONTROL_API } from '@syncode/contracts';
import { ROOM_STATUSES, RoomRole, RoomStatus } from '@syncode/shared';
import { Badge, Button, Card, cn, Input } from '@syncode/ui';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { formatDistanceToNowStrict } from 'date-fns';
import {
  AlertTriangle,
  ArrowRight,
  Clock3,
  Code2,
  Hash,
  LinkIcon,
  Loader2,
  Plus,
  Radio,
  Users,
} from 'lucide-react';
import { motion } from 'motion/react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api-client.js';
import { requireAuth } from '@/lib/auth.js';

export const Route = createFileRoute('/rooms/')({
  beforeLoad: requireAuth,
  component: RoomsPage,
});

type StatusFilter = RoomStatus | 'all';

const STATUS_STYLES: Record<string, { dot: string; badge: string }> = {
  waiting: {
    dot: 'bg-amber-400 shadow-[0_0_6px_oklch(0.76_0.16_75/0.6)]',
    badge: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  },
  warmup: {
    dot: 'bg-sky-400 shadow-[0_0_6px_oklch(0.72_0.14_230/0.6)]',
    badge: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
  },
  coding: {
    dot: 'bg-primary shadow-[0_0_6px_oklch(0.82_0.18_165/0.6)] animate-pulse',
    badge: 'border-primary/30 bg-primary/10 text-primary',
  },
  wrapup: {
    dot: 'bg-violet-400 shadow-[0_0_6px_oklch(0.65_0.18_290/0.6)]',
    badge: 'border-violet-500/30 bg-violet-500/10 text-violet-400',
  },
  finished: {
    dot: 'bg-muted-foreground/50',
    badge: 'border-border bg-muted/30 text-muted-foreground',
  },
};

const ROLE_LABEL_KEYS: Record<string, string> = {
  [RoomRole.HOST]: 'role.host',
  [RoomRole.CANDIDATE]: 'role.candidate',
  [RoomRole.INTERVIEWER]: 'role.interviewer',
  [RoomRole.SPECTATOR]: 'role.observer',
};

const ROOM_STATUS_KEYS: Record<RoomStatus, string> = {
  [RoomStatus.WAITING]: 'status.waiting',
  [RoomStatus.WARMUP]: 'status.warmup',
  [RoomStatus.CODING]: 'status.coding',
  [RoomStatus.WRAPUP]: 'status.wrapup',
  [RoomStatus.FINISHED]: 'status.finished',
};

function parseInviteInput(raw: string): { roomId: string; code: string } | null {
  const trimmed = raw.trim();

  // Full URL: .../rooms/{uuid}?code=XXXXXX
  try {
    const url = new URL(trimmed, globalThis.location.origin);
    const match = /\/rooms\/([^/]+)/.exec(url.pathname);
    const code = url.searchParams.get('code');
    if (match?.[1] && code) {
      return { roomId: match[1], code: code.toUpperCase() };
    }
  } catch {
    // Not a URL, just fall through.
  }

  return null;
}

function formatTimeAgo(iso: string): string {
  return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
}

function RoomsPage() {
  const { t } = useTranslation('rooms');
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [inviteInput, setInviteInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  const statusFilters = useMemo(
    () => [
      { value: 'all' as StatusFilter, label: t('filter.all') },
      ...ROOM_STATUSES.map((s) => ({ value: s as StatusFilter, label: t(ROOM_STATUS_KEYS[s]) })),
    ],
    [t],
  );

  const roomsQuery = useQuery({
    queryKey: ['rooms', 'list', statusFilter],
    queryFn: () =>
      api(CONTROL_API.ROOMS.LIST, {
        searchParams: {
          limit: 50,
          ...(statusFilter === 'all' ? {} : { status: statusFilter }),
        },
      }),
  });

  const rooms = roomsQuery.data?.data ?? [];

  const { activeCount, totalCount } = useMemo(() => {
    const active = rooms.filter((r) => r.status !== 'finished').length;
    return { activeCount: active, totalCount: rooms.length };
  }, [rooms]);

  const handleJoin = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setJoinError(null);

    const parsed = parseInviteInput(inviteInput);
    if (!parsed) {
      setJoinError(t('join.error'));
      return;
    }

    void navigate({
      to: '/rooms/$roomId',
      params: { roomId: parsed.roomId },
      search: { code: parsed.code },
    }).catch(() => {});
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10 lg:py-12">
      <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t('heading')}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {statusFilter === 'all'
              ? activeCount > 0
                ? `${t('subtitle.activeCount', { count: activeCount })} · ${t('subtitle.totalLabel', { totalCount })}`
                : t('subtitle.noActive')
              : t('subtitle.totalCount', { count: totalCount })}
          </p>
        </div>

        <Link to="/rooms/create">
          <Button className="gap-2 rounded-xl shadow-[0_0_25px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_35px_hsl(var(--primary)/0.5)]">
            <Plus size={18} />
            {t('button.createRoom')}
          </Button>
        </Link>
      </div>

      <Card className="mb-10 rounded-2xl border-border/50 bg-card/60 p-6 backdrop-blur-sm sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-8">
          <div className="shrink-0">
            <div className="mb-2 flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                <LinkIcon size={18} />
              </div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                {t('join.heading')}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground lg:max-w-xs">{t('join.description')}</p>
          </div>

          <form
            onSubmit={handleJoin}
            className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-start"
          >
            <div className="flex-1">
              <div className="flex items-center rounded-xl border border-border/60 bg-background p-1.5 transition-all duration-300 focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/20">
                <Hash size={18} className="ml-2.5 shrink-0 text-muted-foreground/60" />
                <Input
                  type="text"
                  value={inviteInput}
                  onChange={(e) => {
                    setInviteInput(e.target.value);
                    setJoinError(null);
                  }}
                  placeholder={t('join.placeholder')}
                  className="flex-1 border-none bg-transparent font-mono text-sm shadow-none focus-visible:ring-0"
                />
              </div>
              {joinError && <p className="mt-1.5 pl-1 text-xs text-destructive">{joinError}</p>}
            </div>
            <Button
              type="submit"
              variant="outline"
              className="shrink-0 gap-2 rounded-xl sm:mt-1.5"
              disabled={!inviteInput.trim()}
            >
              {t('join.button')}
              <ArrowRight size={16} />
            </Button>
          </form>
        </div>
      </Card>

      <div className="mb-6 flex flex-wrap gap-2">
        {statusFilters.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={statusFilter === f.value}
            onClick={() => setStatusFilter(f.value)}
            className={cn(
              'inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium transition-colors',
              statusFilter === f.value
                ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {roomsQuery.isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={32} className="animate-spin text-primary/60" />
        </div>
      ) : roomsQuery.isError ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <AlertTriangle size={32} className="mb-4 text-destructive/60" />
          <h3 className="text-lg font-semibold text-foreground">{t('error.loadFailed')}</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {t('error.loadFailedDescription')}
          </p>
          <Button
            variant="outline"
            className="mt-4 rounded-xl"
            onClick={() => roomsQuery.refetch()}
          >
            {t('error.retry')}
          </Button>
        </div>
      ) : rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-4 flex size-16 items-center justify-center rounded-2xl border border-border/50 bg-card/60">
            <Radio size={28} className="text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">{t('empty.noRooms')}</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {statusFilter === 'all'
              ? t('empty.noRoomsDescription')
              : t('empty.noRoomsWithStatus', {
                  status: statusFilters.find((f) => f.value === statusFilter)?.label,
                })}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rooms.map((room, index) => {
            const fallback = {
              dot: 'bg-muted-foreground/50',
              badge: 'border-border bg-muted/30 text-muted-foreground',
            };
            const styles = STATUS_STYLES[room.status] ?? fallback;

            return (
              <motion.div
                key={room.roomId}
                initial={{ opacity: 0, y: 16, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{
                  duration: 0.36,
                  delay: index * 0.05,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <Link to="/rooms/$roomId" params={{ roomId: room.roomId }} className="block">
                  <Card className="group h-full rounded-2xl border border-white/[0.035] bg-card/40 p-5 ring-1 ring-border/30 backdrop-blur-sm transition-all duration-200 hover:border-primary/12 hover:bg-card/60 hover:shadow-[0_10px_30px_-24px_color-mix(in_oklch,var(--primary)_80%,transparent)] hover:ring-primary/20 sm:p-6">
                    {/* Top row: status + meta */}
                    <div className="mb-4 flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className={cn('gap-1.5 px-2.5 py-1 text-xs', styles.badge)}
                      >
                        <span className={cn('inline-block size-1.5 rounded-full', styles.dot)} />
                        {t(ROOM_STATUS_KEYS[room.status as RoomStatus] ?? room.status)}
                      </Badge>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users size={13} />
                          {room.participantCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock3 size={13} />
                          {formatTimeAgo(room.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Room name / problem */}
                    <h3 className="mb-1.5 text-base font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
                      {room.name ?? t('card.untitledRoom')}
                    </h3>

                    {room.problemTitle && (
                      <p className="mb-4 text-sm text-muted-foreground">{room.problemTitle}</p>
                    )}

                    {/* Bottom row: role + language + code */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {t(ROLE_LABEL_KEYS[room.myRole] ?? room.myRole)}
                      </Badge>

                      {room.language && (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Code2 size={12} />
                          {room.language}
                        </Badge>
                      )}

                      <span className="ml-auto font-mono text-[11px] tracking-wider text-muted-foreground/60">
                        {room.roomCode}
                      </span>
                    </div>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
