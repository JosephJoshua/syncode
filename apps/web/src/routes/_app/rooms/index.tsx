import { CONTROL_API, type ListRoomsQuery } from '@syncode/contracts';
import { ROOM_STATUSES, type RoomStatus as RoomStatusType } from '@syncode/shared';
import {
  Badge,
  Button,
  Card,
  cn,
  Input,
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@syncode/ui';
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
import { FilterPill } from '@/components/filter-pill.js';
import { api } from '@/lib/api-client.js';
import { ROLE_LABEL_KEYS, ROOM_STATUS_KEYS, ROOM_STATUS_STYLES } from '@/lib/room-stage.js';

export const Route = createFileRoute('/_app/rooms/')({
  component: RoomsPage,
});

type StatusFilter = RoomStatusType | 'all';
const ROOMS_PAGE_SIZE = 10;

const STATUS_FILTER_VALUES: StatusFilter[] = ['all', ...ROOM_STATUSES];

function createInitialPaginationState() {
  return {
    currentCursor: undefined as string | undefined,
    cursorHistory: [] as Array<string | undefined>,
  };
}

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

export function RoomsPage() {
  const { t } = useTranslation('rooms');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [paginationState, setPaginationState] = useState(createInitialPaginationState);
  const [inviteInput, setInviteInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const roomsListQuery = useMemo<ListRoomsQuery>(
    () => ({
      cursor: paginationState.currentCursor,
      limit: ROOMS_PAGE_SIZE,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      ...(statusFilter === 'all' ? {} : { status: statusFilter }),
    }),
    [paginationState.currentCursor, statusFilter],
  );

  const roomsQuery = useQuery({
    queryKey: ['rooms', 'list', roomsListQuery],
    queryFn: () =>
      api(CONTROL_API.ROOMS.LIST, {
        searchParams: roomsListQuery,
      }),
    placeholderData: (previousData) => previousData,
  });

  const rooms = roomsQuery.data?.data ?? [];
  const roomsCount = rooms.length;
  const hasPreviousPage = paginationState.cursorHistory.length > 0;
  const nextCursor = roomsQuery.data?.pagination.nextCursor ?? null;
  const hasNextPage = roomsQuery.data?.pagination.hasMore === true && nextCursor !== null;

  const resetCursorPagination = () => {
    setPaginationState(createInitialPaginationState());
  };

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
    <div>
      <motion.div
        className="mb-6 flex items-start justify-between gap-4"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
      >
        <div>
          <div className="mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Radio size={20} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t('heading')}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {statusFilter === 'all'
              ? roomsCount > 0
                ? t('subtitle.pageCount', { count: roomsCount })
                : t('subtitle.noActive')
              : t('subtitle.pageCountWithStatus', {
                  count: roomsCount,
                  status: t(ROOM_STATUS_KEYS[statusFilter]),
                })}
          </p>
        </div>

        <Link to="/rooms/create">
          <Button className="gap-2 shadow-[0_0_25px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_35px_hsl(var(--primary)/0.5)]">
            <Plus size={18} />
            {t('button.createRoom')}
          </Button>
        </Link>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
      >
        <Card className="mb-6 rounded-xl border-border/50 bg-card/60 p-6 backdrop-blur-sm sm:p-8">
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
                <div className="relative">
                  <Hash
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60"
                  />
                  <Input
                    type="text"
                    value={inviteInput}
                    onChange={(e) => {
                      setInviteInput(e.target.value);
                      setJoinError(null);
                    }}
                    placeholder={t('join.placeholder')}
                    className="pl-10 font-mono text-sm"
                  />
                </div>
                {joinError && <p className="mt-1.5 pl-1 text-xs text-destructive">{joinError}</p>}
              </div>
              <Button
                type="submit"
                variant="outline"
                size="lg"
                className="shrink-0 gap-2"
                disabled={!inviteInput.trim()}
              >
                {t('join.button')}
                <ArrowRight size={16} />
              </Button>
            </form>
          </div>
        </Card>
      </motion.div>

      <div className="mb-6 flex flex-wrap gap-2">
        {STATUS_FILTER_VALUES.map((value) => (
          <FilterPill
            key={value}
            active={statusFilter === value}
            onClick={() => {
              setStatusFilter(value);
              resetCursorPagination();
            }}
          >
            {value === 'all' ? t('filter.all') : t(ROOM_STATUS_KEYS[value])}
          </FilterPill>
        ))}
      </div>

      {roomsQuery.isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={32} className="animate-spin text-primary/60" />
        </div>
      ) : roomsQuery.isError ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-destructive/40 bg-card/30 px-6 py-20 text-center backdrop-blur-sm">
          <div className="relative mb-5">
            <div className="absolute inset-0 -z-10 rounded-full bg-destructive/15 blur-2xl" />
            <div className="flex size-16 items-center justify-center rounded-2xl border border-destructive/40 bg-card text-destructive/70">
              <AlertTriangle size={28} />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-foreground">{t('error.loadFailed')}</h3>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            {t('error.loadFailedDescription')}
          </p>
          <Button variant="outline" className="mt-5" onClick={() => roomsQuery.refetch()}>
            {t('error.retry')}
          </Button>
        </div>
      ) : rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card/30 px-6 py-20 text-center backdrop-blur-sm">
          <div className="relative mb-5">
            <div className="absolute inset-0 -z-10 rounded-full bg-primary/15 blur-2xl" />
            <div className="flex size-16 items-center justify-center rounded-2xl border border-border/60 bg-card text-primary">
              <Radio size={28} />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-foreground">{t('empty.noRooms')}</h3>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            {statusFilter === 'all'
              ? t('empty.noRoomsDescription')
              : t('empty.noRoomsWithStatus', { status: t(ROOM_STATUS_KEYS[statusFilter]) })}
          </p>
        </div>
      ) : (
        <div>
          <div className="grid gap-4 md:grid-cols-2">
            {rooms.map((room, index) => {
              const fallback = {
                dot: 'bg-muted-foreground/50',
                badge: 'border-border bg-muted/30 text-muted-foreground',
              };
              const styles = ROOM_STATUS_STYLES[room.status] ?? fallback;

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
                    <Card className="group h-full rounded-2xl border border-white/[0.035] bg-card/50 p-5 ring-1 ring-border/30 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:bg-card/70 hover:shadow-[0_20px_40px_-24px_color-mix(in_oklch,var(--primary)_70%,transparent)] hover:ring-primary/20 sm:p-6">
                      {/* Top row: status + meta */}
                      <div className="mb-4 flex items-center justify-between">
                        <Badge
                          variant="outline"
                          className={cn('gap-1.5 px-2.5 py-1 text-xs', styles.badge)}
                        >
                          <span className={cn('inline-block size-1.5 rounded-full', styles.dot)} />
                          {t(ROOM_STATUS_KEYS[room.status as RoomStatusType] ?? room.status)}
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

          <Pagination className="pt-6">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  aria-label={tCommon('pagination.previousAria')}
                  disabled={!hasPreviousPage || roomsQuery.isFetching}
                  onClick={() => {
                    if (!hasPreviousPage || roomsQuery.isFetching) {
                      return;
                    }

                    setPaginationState((current) => ({
                      currentCursor: current.cursorHistory[current.cursorHistory.length - 1],
                      cursorHistory: current.cursorHistory.slice(0, -1),
                    }));
                  }}
                >
                  {tCommon('pagination.previous')}
                </PaginationPrevious>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  aria-label={tCommon('pagination.nextAria')}
                  disabled={!hasNextPage || roomsQuery.isFetching}
                  onClick={() => {
                    if (!hasNextPage || !nextCursor || roomsQuery.isFetching) {
                      return;
                    }

                    setPaginationState((current) => ({
                      currentCursor: nextCursor,
                      cursorHistory: [...current.cursorHistory, current.currentCursor],
                    }));
                  }}
                >
                  {tCommon('pagination.next')}
                </PaginationNext>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
