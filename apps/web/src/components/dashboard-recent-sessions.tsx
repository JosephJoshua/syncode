import { ERROR_CODES, type UserWeaknessesResponse } from '@syncode/contracts';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Avatar,
  AvatarFallback,
  AvatarImage,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@syncode/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { GitCompareArrows, Loader2, Search, Trash2 } from 'lucide-react';
import { useDeferredValue, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api-client.js';
import type {
  DashboardSessionHistory,
  SessionParticipant,
  SessionRole,
  SessionRow,
  SessionStatus,
} from '@/lib/dashboard-session-history.js';
import {
  deleteSession,
  formatSessionDateTime,
  getDashboardSessionHistoryQueryKey,
  removeSessionFromDashboardHistory,
} from '@/lib/dashboard-session-history.js';
import { getUserInitial } from '@/lib/user-utils.js';
import {
  removeSessionFromUserWeaknesses,
  USER_WEAKNESSES_QUERY_KEY,
} from '@/lib/user-weaknesses.js';
import { useAuthStore } from '@/stores/auth.store.js';

type SessionFilter = 'all' | 'passed' | 'failed';
type SessionSort = 'date-desc' | 'date-asc' | 'score-desc' | 'score-asc' | 'duration-desc';
const SESSION_HISTORY_PAGE_SIZE = 10;

function getStatusBadgeVariant(status: SessionStatus) {
  if (status === 'passed') {
    return 'success';
  }

  if (status === 'failed') {
    return 'warning';
  }

  return 'neutral';
}

function getRoleBadgeVariant(role: SessionRole) {
  if (role === 'candidate') {
    return 'candidate';
  }

  if (role === 'interviewer') {
    return 'interviewer';
  }

  return 'observer';
}

function compareRows(a: SessionRow, b: SessionRow, sortBy: SessionSort) {
  if (sortBy === 'date-asc') {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  }

  if (sortBy === 'score-desc') {
    return getSortableScore(b) - getSortableScore(a);
  }

  if (sortBy === 'score-asc') {
    return getSortableScore(a) - getSortableScore(b);
  }

  if (sortBy === 'duration-desc') {
    return b.durationSeconds - a.durationSeconds;
  }

  return new Date(b.date).getTime() - new Date(a.date).getTime();
}

function getSortableScore(row: SessionRow) {
  if (typeof row.score === 'number') {
    return row.score;
  }

  return -1;
}

function ParticipantAvatar({
  participant,
  currentUserInitial,
}: {
  readonly participant: SessionParticipant | null;
  readonly currentUserInitial: string;
}) {
  if (!participant) {
    return <span className="text-muted-foreground">-</span>;
  }

  const initials =
    participant.isCurrentUser && currentUserInitial ? currentUserInitial : participant.initials;
  const label = participant.isCurrentUser
    ? `${participant.name} (${currentUserInitial})`
    : participant.name;

  return (
    <Avatar className="mx-auto size-8" aria-label={label} title={label}>
      {participant.avatarUrl ? <AvatarImage src={participant.avatarUrl} alt="" /> : null}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}

export function DashboardRecentSessions({
  viewerId,
  rows,
  isLoading = false,
  isError = false,
  isUnavailable = false,
  onRetry,
}: {
  readonly viewerId: string | null;
  readonly rows: SessionRow[];
  readonly isLoading?: boolean;
  readonly isError?: boolean;
  readonly isUnavailable?: boolean;
  readonly onRetry?: () => void;
}) {
  const { t } = useTranslation('dashboard');
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const currentUserInitial = getUserInitial(user) || 'U';
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [filter, setFilter] = useState<SessionFilter>('all');
  const [sortBy, setSortBy] = useState<SessionSort>('date-desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pendingDeleteSessionId, setPendingDeleteSessionId] = useState<string | null>(null);
  const sessionHistoryQueryKey = getDashboardSessionHistoryQueryKey(viewerId);

  const normalizedQuery = deferredSearchQuery.trim().toLowerCase();
  const baseRows = rows.map((row) => {
    if (!row.observer?.isCurrentUser) {
      return row;
    }

    return {
      ...row,
      observer: {
        ...row.observer,
        initials: currentUserInitial,
      },
    };
  });

  const filteredRows = baseRows
    .filter((row) => row.problemName.toLowerCase().includes(normalizedQuery))
    .filter((row) => {
      if (filter === 'passed') {
        return row.status === 'passed';
      }

      if (filter === 'failed') {
        return row.status === 'failed';
      }

      return true;
    })
    .sort((a, b) => compareRows(a, b, sortBy));
  const totalPages = Math.ceil(filteredRows.length / SESSION_HISTORY_PAGE_SIZE);

  const hasBaseRows = baseRows.length > 0;
  const hasVisibleRows = filteredRows.length > 0;
  // Clamp the page in derived calculations so that a stale currentPage (e.g.
  // after rows shrink on refresh) doesn't render an empty slice with an
  // invalid summary range while the useEffect correction is pending.
  const safeCurrentPage = hasVisibleRows ? Math.min(Math.max(currentPage, 1), totalPages) : 1;
  const paginatedRows = filteredRows.slice(
    (safeCurrentPage - 1) * SESSION_HISTORY_PAGE_SIZE,
    safeCurrentPage * SESSION_HISTORY_PAGE_SIZE,
  );
  const hasPreviousPage = safeCurrentPage > 1;
  const hasNextPage = safeCurrentPage < totalPages;
  const pageStart = hasVisibleRows ? (safeCurrentPage - 1) * SESSION_HISTORY_PAGE_SIZE + 1 : 0;
  const pageEnd = hasVisibleRows
    ? Math.min(safeCurrentPage * SESSION_HISTORY_PAGE_SIZE, filteredRows.length)
    : 0;

  useEffect(() => {
    if (!hasVisibleRows) {
      if (currentPage !== 1) {
        setCurrentPage(1);
      }

      return;
    }

    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, hasVisibleRows, totalPages]);

  const deleteSessionMutation = useMutation<
    void,
    unknown,
    { sessionId: string },
    { previousHistory?: DashboardSessionHistory; previousWeaknesses?: UserWeaknessesResponse }
  >({
    mutationFn: async ({ sessionId }) => {
      await deleteSession(sessionId);
    },
    onMutate: async ({ sessionId }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: sessionHistoryQueryKey }),
        queryClient.cancelQueries({ queryKey: USER_WEAKNESSES_QUERY_KEY }),
      ]);

      const previousHistory =
        queryClient.getQueryData<DashboardSessionHistory>(sessionHistoryQueryKey);
      const previousWeaknesses =
        queryClient.getQueryData<UserWeaknessesResponse>(USER_WEAKNESSES_QUERY_KEY);

      queryClient.setQueryData<DashboardSessionHistory>(sessionHistoryQueryKey, (currentHistory) =>
        currentHistory
          ? removeSessionFromDashboardHistory(currentHistory, sessionId)
          : currentHistory,
      );
      queryClient.setQueryData<UserWeaknessesResponse>(
        USER_WEAKNESSES_QUERY_KEY,
        (currentWeaknesses) =>
          currentWeaknesses
            ? removeSessionFromUserWeaknesses(currentWeaknesses, sessionId)
            : currentWeaknesses,
      );

      return { previousHistory, previousWeaknesses };
    },
    onSuccess: () => {
      // Close the dialog only after the request lands so the in-dialog
      // pending UI ('Deleting...') is actually visible.
      setPendingDeleteSessionId(null);
      void queryClient.invalidateQueries({ queryKey: USER_WEAKNESSES_QUERY_KEY });
    },
    onError: (error, _variables, context) => {
      if (context?.previousHistory) {
        queryClient.setQueryData(sessionHistoryQueryKey, context.previousHistory);
      }

      if (context?.previousWeaknesses) {
        queryClient.setQueryData(USER_WEAKNESSES_QUERY_KEY, context.previousWeaknesses);
      }

      // Refetch only on error so the optimistic update is reconciled with
      // server truth. The success path already removed the row optimistically.
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: sessionHistoryQueryKey }),
        queryClient.invalidateQueries({ queryKey: USER_WEAKNESSES_QUERY_KEY }),
      ]);
      toast.error(getDeleteSessionErrorMessage(error, t));
    },
  });

  const handleDeleteSessionClick = (sessionId: string) => {
    setPendingDeleteSessionId(sessionId);
  };

  const handleDeleteDialogOpenChange = (open: boolean) => {
    if (!open) {
      setPendingDeleteSessionId(null);
    }
  };

  const confirmDeleteSession = () => {
    if (!pendingDeleteSessionId || !viewerId || deleteSessionMutation.isPending) {
      return;
    }

    deleteSessionMutation.mutate({ sessionId: pendingDeleteSessionId });
  };

  return (
    <section className="mt-10 sm:mt-12">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="shrink-0 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {t('recentSessions')}
          </h2>
          <Button
            asChild
            className="h-9 gap-2 bg-emerald-600 text-white hover:bg-emerald-500"
            size="sm"
          >
            <Link to="/sessions/compare">
              <GitCompareArrows className="size-4" />
              {t('actions.compareSessions')}
            </Link>
          </Button>
        </div>

        <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center xl:justify-end xl:gap-4">
          <div className="relative w-full md:min-w-[320px] md:flex-1 xl:max-w-100">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setCurrentPage(1);
              }}
              placeholder={t('search.placeholder')}
              className="h-11 pl-9"
            />
          </div>

          <Select
            value={filter}
            onValueChange={(value) => {
              setFilter(value as SessionFilter);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger
              className="w-full md:w-42.5 xl:flex-none"
              aria-label={t('aria.filterSessions')}
            >
              <SelectValue placeholder={t('filter.all')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filter.all')}</SelectItem>
              <SelectItem value="passed">{t('filter.passedOnly')}</SelectItem>
              <SelectItem value="failed">{t('filter.failedOnly')}</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={sortBy}
            onValueChange={(value) => {
              setSortBy(value as SessionSort);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger
              className="w-full md:w-57.5 xl:flex-none"
              aria-label={t('aria.sortSessions')}
            >
              <SelectValue placeholder={t('sort.dateNewest')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">{t('sort.dateNewest')}</SelectItem>
              <SelectItem value="date-asc">{t('sort.dateOldest')}</SelectItem>
              <SelectItem value="score-desc">{t('sort.scoreHigh')}</SelectItem>
              <SelectItem value="score-asc">{t('sort.scoreLow')}</SelectItem>
              <SelectItem value="duration-desc">{t('sort.duration')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="mt-5 gap-0 overflow-hidden border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
        {isLoading ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
            <h3 className="text-lg font-semibold tracking-tight text-foreground">
              {t('empty.loadingTitle')}
            </h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {t('empty.loadingDescription')}
            </p>
          </div>
        ) : isUnavailable ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
            <h3 className="text-lg font-semibold tracking-tight text-foreground">
              {t('empty.unavailableTitle')}
            </h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {t('empty.unavailableDescription')}
            </p>
          </div>
        ) : isError ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
            <h3 className="text-lg font-semibold tracking-tight text-foreground">
              {t('empty.errorTitle')}
            </h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {t('empty.errorDescription')}
            </p>
            {onRetry ? (
              <Button variant="outline" className="mt-4" onClick={onRetry}>
                {t('common:retry')}
              </Button>
            ) : null}
          </div>
        ) : hasVisibleRows ? (
          <>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-35 text-center">{t('table.date')}</TableHead>
                  <TableHead className="min-w-65 text-center">{t('table.problem')}</TableHead>
                  <TableHead className="w-22 text-center">{t('table.partner')}</TableHead>
                  <TableHead className="w-24 text-center">{t('table.observer')}</TableHead>
                  <TableHead className="w-30 text-center">{t('table.role')}</TableHead>
                  <TableHead className="w-30 text-center">{t('table.status')}</TableHead>
                  <TableHead className="w-22.5 text-center">{t('table.score')}</TableHead>
                  <TableHead className="w-25 text-center">{t('table.duration')}</TableHead>
                  <TableHead className="w-20 text-center">{t('table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-muted-foreground">
                      {formatSessionDateTime(row.date)}
                    </TableCell>
                    <TableCell>
                      <Link
                        to="/sessions/$sessionId"
                        params={{ sessionId: row.id }}
                        className="block truncate rounded-sm font-medium text-foreground transition-colors hover:text-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        title={row.problemName}
                      >
                        {row.problemName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-center">
                      <ParticipantAvatar
                        participant={row.partner}
                        currentUserInitial={currentUserInitial}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <ParticipantAvatar
                        participant={row.observer}
                        currentUserInitial={currentUserInitial}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={getRoleBadgeVariant(row.role)}>{t(`role.${row.role}`)}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {row.role === 'candidate' && row.status ? (
                        <Badge variant={getStatusBadgeVariant(row.status)}>
                          {row.status === 'passed' ? t('status.pass') : t('status.failed')}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.role === 'candidate' && typeof row.score === 'number' ? (
                        <span
                          className={cn(
                            'font-medium',
                            row.status === 'passed' ? 'text-primary' : 'text-amber-400',
                          )}
                        >
                          {row.score}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {row.durationLabel}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={t('actions.deleteSessionAriaLabelWithProblem', {
                          problem: row.problemName,
                          date: formatSessionDateTime(row.date),
                        })}
                        disabled={deleteSessionMutation.isPending || !viewerId}
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:text-destructive focus-visible:ring-destructive/20"
                        onClick={() => handleDeleteSessionClick(row.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {hasVisibleRows ? (
              <div className="flex flex-col gap-3 border-t border-border/50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <p className="text-sm text-muted-foreground">
                  {t('pagination.summary', {
                    start: pageStart,
                    end: pageEnd,
                    total: filteredRows.length,
                  })}
                </p>

                <Pagination className="justify-end">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        aria-label={t('aria.previousPage')}
                        disabled={!hasPreviousPage}
                        onClick={() => {
                          if (!hasPreviousPage) {
                            return;
                          }

                          setCurrentPage((page) => page - 1);
                        }}
                      >
                        {t('pagination.previous')}
                      </PaginationPrevious>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        aria-label={t('aria.nextPage')}
                        disabled={!hasNextPage}
                        onClick={() => {
                          if (!hasNextPage) {
                            return;
                          }

                          setCurrentPage((page) => page + 1);
                        }}
                      >
                        {t('pagination.next')}
                      </PaginationNext>
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
            <h3 className="text-lg font-semibold tracking-tight text-foreground">
              {hasBaseRows ? t('empty.noMatchTitle') : t('empty.noSessionsTitle')}
            </h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {hasBaseRows ? t('empty.noMatchDescription') : t('empty.noSessionsDescription')}
            </p>
          </div>
        )}

        <AlertDialog
          open={pendingDeleteSessionId !== null}
          onOpenChange={handleDeleteDialogOpenChange}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
              <AlertDialogDescription>{t('deleteDialog.description')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteSessionMutation.isPending}>
                {t('deleteDialog.cancel')}
              </AlertDialogCancel>
              {/*
                Use a plain Button instead of AlertDialogAction: AlertDialogAction
                triggers Radix's close-on-click, which would unmount the dialog
                before the pending UI ('Deleting...') becomes visible. We close
                explicitly in the mutation's onSuccess.
              */}
              <Button
                type="button"
                variant="destructive"
                disabled={deleteSessionMutation.isPending || !viewerId}
                onClick={confirmDeleteSession}
              >
                {deleteSessionMutation.isPending ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    {t('deleteDialog.deleting')}
                  </span>
                ) : (
                  t('deleteDialog.confirm')
                )}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    </section>
  );
}

function getDeleteSessionErrorMessage(error: unknown, t: (key: string) => string) {
  if (error instanceof ApiError) {
    if (error.response.code === ERROR_CODES.SESSION_NOT_FOUND) {
      return t('deleteToast.sessionNotFound');
    }

    if (error.response.code === ERROR_CODES.SESSION_NOT_PARTICIPANT) {
      return t('deleteToast.notParticipant');
    }

    if (error.response.statusCode === 401) {
      return t('deleteToast.unauthorized');
    }

    return error.response.message || t('deleteToast.deleteFailed');
  }

  return t('deleteToast.deleteFailed');
}
