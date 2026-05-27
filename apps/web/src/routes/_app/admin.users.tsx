import { type AdminUser, type AdminUsersQuery, CONTROL_API } from '@syncode/contracts';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Label,
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Ban, Loader2, RefreshCw, Search, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AdminTabs } from '@/components/admin/admin-tabs.js';
import { api } from '@/lib/api-client.js';
import { useAuthStore } from '@/stores/auth.store.js';

export const Route = createFileRoute('/_app/admin/users')({
  component: AdminUsersPage,
});

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

type StatusFilter = 'all' | 'active' | 'banned';

function createPaginationState() {
  return {
    currentCursor: undefined as string | undefined,
    cursorHistory: [] as Array<string | undefined>,
  };
}

export function AdminUsersPage() {
  const { t, i18n } = useTranslation('admin');
  const { t: tCommon } = useTranslation('common');
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [paginationState, setPaginationState] = useState(createPaginationState);
  const [banTarget, setBanTarget] = useState<AdminUser | null>(null);
  const [banReason, setBanReason] = useState('');
  const [isRefreshingAfterMutation, setIsRefreshingAfterMutation] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  const query = useMemo<AdminUsersQuery>(
    () => ({
      cursor: paginationState.currentCursor,
      limit: PAGE_SIZE,
      search: debouncedSearch.trim() || undefined,
      status: status === 'all' ? undefined : status,
    }),
    [paginationState.currentCursor, debouncedSearch, status],
  );

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    [i18n.language, i18n.resolvedLanguage],
  );

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', query],
    enabled: user?.role === 'admin',
    queryFn: () => api(CONTROL_API.ADMIN.USERS.LIST, { searchParams: query }),
  });

  const updateUserMutation = useMutation({
    mutationFn: (input: { user: AdminUser; action: 'ban' | 'unban'; reason?: string }) => {
      if (input.action === 'ban') {
        return api(CONTROL_API.ADMIN.USERS.BAN, {
          params: { id: input.user.id },
          body: { reason: input.reason?.trim() || undefined },
        });
      }

      return api(CONTROL_API.ADMIN.USERS.UNBAN, { params: { id: input.user.id } });
    },
    onSuccess: async (_updated, variables) => {
      toast.success(
        variables.action === 'ban'
          ? t('users.feedback.banSuccess')
          : t('users.feedback.unbanSuccess'),
      );
      setBanTarget(null);
      setBanReason('');
      setIsRefreshingAfterMutation(true);
      try {
        await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      } finally {
        setIsRefreshingAfterMutation(false);
      }
    },
    onError: () => {
      toast.error(t('users.feedback.mutationError'));
    },
  });

  if (user?.role !== 'admin') {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:py-12">
        <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
          <CardContent className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-4 inline-flex size-12 items-center justify-center rounded-full border border-destructive/25 bg-destructive/10 text-destructive">
              <ShieldAlert className="size-5" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {t('users.forbidden.title')}
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              {t('users.forbidden.description')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isSearchSettling = search.trim() !== debouncedSearch.trim();
  const isUsersLoading = usersQuery.isLoading || isSearchSettling;
  const isUsersFetching = usersQuery.isFetching || isSearchSettling;
  const isUserMutationBusy = updateUserMutation.isPending || isRefreshingAfterMutation;
  const users = isSearchSettling ? [] : (usersQuery.data?.data ?? []);
  const nextCursor = usersQuery.data?.pagination.nextCursor ?? null;
  const hasNextPage = usersQuery.data?.pagination.hasMore === true && nextCursor !== null;
  const hasPreviousPage = paginationState.cursorHistory.length > 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:py-12">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t('users.heading')}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">{t('users.sub')}</p>
        </div>
        <div className="flex flex-wrap gap-2 self-start md:self-auto">
          <AdminTabs
            active="users"
            labels={{
              users: t('navLinks.users'),
              problems: t('navLinks.problems'),
              auditLogs: t('navLinks.auditLogs'),
            }}
          />
          <Button
            variant="outline"
            className="gap-2"
            disabled={isUsersFetching}
            onClick={() => {
              usersQuery.refetch().catch(() => undefined);
            }}
          >
            <RefreshCw className="size-4" />
            {t('users.actions.refresh')}
          </Button>
        </div>
      </section>

      <section className="mt-8 grid gap-4 rounded-xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-2">
          <Label htmlFor="admin-user-search">{t('users.search.label')}</Label>
          <div className="relative">
            <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground" />
            <Input
              id="admin-user-search"
              value={search}
              placeholder={t('users.search.placeholder')}
              className="pl-9"
              onChange={(event) => {
                setSearch(event.target.value);
                setPaginationState(createPaginationState());
              }}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-user-status">{t('users.status.label')}</Label>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as StatusFilter);
              setPaginationState(createPaginationState());
            }}
          >
            <SelectTrigger id="admin-user-status" aria-label={t('users.status.label')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('users.status.all')}</SelectItem>
              <SelectItem value="active">{t('users.status.active')}</SelectItem>
              <SelectItem value="banned">{t('users.status.banned')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <Card
        className="mt-5 gap-0 overflow-hidden border border-border/50 bg-card/80 py-0 backdrop-blur-sm"
        aria-busy={isUsersFetching}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-70">{t('users.table.user')}</TableHead>
                <TableHead className="w-28 text-center">{t('users.table.role')}</TableHead>
                <TableHead className="w-28 text-center">{t('users.table.status')}</TableHead>
                <TableHead className="min-w-44">{t('users.table.reason')}</TableHead>
                <TableHead className="w-36">{t('users.table.created')}</TableHead>
                <TableHead className="w-28 text-right">{t('users.table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-foreground">
                        {item.displayName || item.username}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        @{item.username} · {item.email}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={item.role === 'admin' ? 'default' : 'outline'}>
                      {t(`users.role.${item.role}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={item.bannedAt ? 'destructive' : 'secondary'}>
                      {item.bannedAt
                        ? t('users.statusBadge.banned')
                        : t('users.statusBadge.active')}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-64 truncate text-sm text-muted-foreground">
                    {item.bannedReason || t('users.emptyValue')}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {dateFormatter.format(new Date(item.createdAt))}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.bannedAt ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isUserMutationBusy || item.id === user.id}
                        onClick={() => updateUserMutation.mutate({ user: item, action: 'unban' })}
                      >
                        <ShieldCheck className="size-4" />
                        {item.id === user.id
                          ? t('users.actions.currentUser')
                          : t('users.actions.unban')}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={isUserMutationBusy || item.id === user.id}
                        onClick={() => setBanTarget(item)}
                      >
                        <Ban className="size-4" />
                        {item.id === user.id
                          ? t('users.actions.currentUser')
                          : t('users.actions.ban')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {isUsersLoading ? (
          <div className="flex min-h-60 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {tCommon('loading')}
          </div>
        ) : null}

        {!isUsersLoading && users.length === 0 ? (
          <div className="flex min-h-60 flex-col items-center justify-center px-6 py-12 text-center">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {t('users.empty.title')}
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {usersQuery.isError ? t('users.feedback.loadError') : t('users.empty.description')}
            </p>
          </div>
        ) : null}
      </Card>

      <div className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {t('users.pagination.summary', { count: users.length })}
        </p>
        <Pagination className="justify-end" aria-label={t('users.pagination.ariaLabel')}>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                aria-label={t('users.pagination.previous')}
                disabled={!hasPreviousPage || isUsersFetching}
                onClick={() => {
                  if (!hasPreviousPage || isUsersFetching) return;
                  setPaginationState((current) => ({
                    currentCursor: current.cursorHistory.at(-1),
                    cursorHistory: current.cursorHistory.slice(0, -1),
                  }));
                }}
              >
                {t('users.pagination.previous')}
              </PaginationPrevious>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                aria-label={t('users.pagination.next')}
                disabled={!hasNextPage || isUsersFetching}
                onClick={() => {
                  if (!hasNextPage || !nextCursor || isUsersFetching) return;
                  setPaginationState((current) => ({
                    currentCursor: nextCursor,
                    cursorHistory: [...current.cursorHistory, current.currentCursor],
                  }));
                }}
              >
                {t('users.pagination.next')}
              </PaginationNext>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
      <output className="sr-only" aria-live="polite" aria-atomic="true">
        {isUsersLoading
          ? tCommon('loading')
          : usersQuery.isError
            ? t('users.feedback.loadError')
            : t('users.pagination.summary', { count: users.length })}
      </output>

      <AlertDialog
        open={Boolean(banTarget)}
        onOpenChange={(open) => {
          if (!open && isUserMutationBusy) {
            return;
          }

          if (!open) {
            setBanTarget(null);
            setBanReason('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('users.banDialog.title', { username: banTarget?.username ?? '' })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('users.banDialog.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ban-reason">{t('users.banDialog.reasonLabel')}</Label>
            <Input
              id="ban-reason"
              value={banReason}
              placeholder={t('users.banDialog.reasonPlaceholder')}
              onChange={(event) => setBanReason(event.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUserMutationBusy}>{tCommon('cancel')}</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={!banTarget || isUserMutationBusy}
              onClick={() => {
                if (!banTarget) return;
                updateUserMutation.mutate({
                  user: banTarget,
                  action: 'ban',
                  reason: banReason,
                });
              }}
            >
              {t('users.banDialog.confirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
