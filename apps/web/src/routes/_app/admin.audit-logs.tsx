import { type AdminAuditLogsQuery, type AuditLog, CONTROL_API } from '@syncode/contracts';
import {
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@syncode/ui';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ChevronDown, ChevronRight, Loader2, RefreshCw, Search, ShieldAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api-client.js';
import { useAuthStore } from '@/stores/auth.store.js';

export const Route = createFileRoute('/_app/admin/audit-logs')({
  component: AdminAuditLogsPage,
});

const PAGE_SIZE = 20;
const FILTER_DEBOUNCE_MS = 300;

function createPaginationState() {
  return {
    currentCursor: undefined as string | undefined,
    cursorHistory: [] as Array<string | undefined>,
  };
}

export function AdminAuditLogsPage() {
  const { t } = useTranslation('admin');
  const { t: tCommon } = useTranslation('common');
  const user = useAuthStore((state) => state.user);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [action, setAction] = useState('');
  const [debouncedAction, setDebouncedAction] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [paginationState, setPaginationState] = useState(createPaginationState);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
      setDebouncedAction(action);
    }, FILTER_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [action, search]);

  const query = useMemo<AdminAuditLogsQuery>(
    () => ({
      cursor: paginationState.currentCursor,
      limit: PAGE_SIZE,
      search: debouncedSearch.trim() || undefined,
      action: debouncedAction.trim() || undefined,
      from: toIsoDateTime(fromDate, 'start'),
      to: toIsoDateTime(toDate, 'end'),
    }),
    [debouncedAction, debouncedSearch, fromDate, paginationState.currentCursor, toDate],
  );

  const auditQuery = useQuery({
    queryKey: ['admin', 'audit-logs', query],
    enabled: user?.role === 'admin',
    queryFn: () => api(CONTROL_API.ADMIN.AUDIT_LOGS, { searchParams: query }),
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
              {t('audit.forbidden.title')}
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              {t('audit.forbidden.description')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const areTextFiltersSettling =
    search.trim() !== debouncedSearch.trim() || action.trim() !== debouncedAction.trim();
  const isAuditLoading = auditQuery.isLoading || areTextFiltersSettling;
  const isAuditFetching = auditQuery.isFetching || areTextFiltersSettling;
  const logs = areTextFiltersSettling ? [] : (auditQuery.data?.data ?? []);
  const nextCursor = auditQuery.data?.pagination.nextCursor ?? null;
  const hasNextPage = auditQuery.data?.pagination.hasMore === true && nextCursor !== null;
  const hasPreviousPage = paginationState.cursorHistory.length > 0;

  const resetFilters = () => {
    setSearch('');
    setAction('');
    setFromDate('');
    setToDate('');
    setExpandedId(null);
    setPaginationState(createPaginationState());
  };

  const resetPagination = () => {
    setExpandedId(null);
    setPaginationState(createPaginationState());
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:py-12">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t('audit.heading')}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">{t('audit.sub')}</p>
        </div>
        <div className="flex flex-wrap gap-2 self-start md:self-auto">
          <Button variant="outline" asChild>
            <Link to="/admin/problems">{t('navLinks.problems')}</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/admin/users">{t('navLinks.users')}</Link>
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            disabled={isAuditFetching}
            onClick={() => {
              auditQuery.refetch().catch(() => undefined);
            }}
          >
            <RefreshCw className="size-4" />
            {t('audit.actions.refresh')}
          </Button>
        </div>
      </section>

      <section className="mt-8 grid gap-4 rounded-xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm md:grid-cols-[minmax(0,1fr)_180px_160px_160px_auto] md:items-end">
        <div className="space-y-2">
          <Label htmlFor="audit-search">{t('audit.filters.searchLabel')}</Label>
          <div className="relative">
            <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground" />
            <Input
              id="audit-search"
              value={search}
              placeholder={t('audit.filters.searchPlaceholder')}
              className="pl-9"
              onChange={(event) => {
                setSearch(event.target.value);
                resetPagination();
              }}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-action">{t('audit.filters.actionLabel')}</Label>
          <Input
            id="audit-action"
            value={action}
            placeholder={t('audit.filters.actionPlaceholder')}
            onChange={(event) => {
              setAction(event.target.value);
              resetPagination();
            }}
          />
        </div>
        <div className="space-y-2">
          <DateFilterPicker
            id="audit-from"
            label={t('audit.filters.fromLabel')}
            value={fromDate}
            onChange={(value) => {
              setFromDate(value);
              resetPagination();
            }}
          />
        </div>
        <div className="space-y-2">
          <DateFilterPicker
            id="audit-to"
            label={t('audit.filters.toLabel')}
            value={toDate}
            onChange={(value) => {
              setToDate(value);
              resetPagination();
            }}
          />
        </div>
        <Button variant="outline" onClick={resetFilters}>
          {t('audit.filters.clear')}
        </Button>
      </section>

      <Card
        className="mt-5 gap-0 overflow-hidden border border-border/50 bg-card/80 py-0 backdrop-blur-sm"
        aria-busy={isAuditFetching}
      >
        {auditQuery.isError && logs.length > 0 ? (
          <div
            className="border-b border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            {t('audit.feedback.loadError')}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-42">{t('audit.table.timestamp')}</TableHead>
                <TableHead className="min-w-56">{t('audit.table.actor')}</TableHead>
                <TableHead className="w-44">{t('audit.table.action')}</TableHead>
                <TableHead className="min-w-56">{t('audit.table.target')}</TableHead>
                <TableHead className="w-34">{t('audit.table.ip')}</TableHead>
                <TableHead className="w-24 text-right">{t('audit.table.details')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <AuditLogRows
                  key={log.id}
                  log={log}
                  isExpanded={expandedId === log.id}
                  onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)}
                />
              ))}
            </TableBody>
          </Table>
        </div>

        {isAuditLoading ? (
          <div className="flex min-h-60 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {tCommon('loading')}
          </div>
        ) : null}

        {!isAuditLoading && logs.length === 0 ? (
          <div
            className="flex min-h-60 flex-col items-center justify-center px-6 py-12 text-center"
            role={auditQuery.isError ? 'alert' : undefined}
          >
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {auditQuery.isError ? t('audit.feedback.loadErrorTitle') : t('audit.empty.title')}
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {auditQuery.isError ? t('audit.feedback.loadError') : t('audit.empty.description')}
            </p>
          </div>
        ) : null}
      </Card>

      <div className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {t('audit.pagination.summary', { count: logs.length })}
        </p>
        <Pagination className="justify-end" aria-label={t('audit.pagination.ariaLabel')}>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                aria-label={t('audit.pagination.previous')}
                disabled={!hasPreviousPage || isAuditFetching}
                onClick={() => {
                  if (!hasPreviousPage || isAuditFetching) return;
                  setExpandedId(null);
                  setPaginationState((current) => ({
                    currentCursor: current.cursorHistory.at(-1),
                    cursorHistory: current.cursorHistory.slice(0, -1),
                  }));
                }}
              >
                {t('audit.pagination.previous')}
              </PaginationPrevious>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                aria-label={t('audit.pagination.next')}
                disabled={!hasNextPage || isAuditFetching}
                onClick={() => {
                  if (!hasNextPage || !nextCursor || isAuditFetching) return;
                  setExpandedId(null);
                  setPaginationState((current) => ({
                    currentCursor: nextCursor,
                    cursorHistory: [...current.cursorHistory, current.currentCursor],
                  }));
                }}
              >
                {t('audit.pagination.next')}
              </PaginationNext>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
      <output className="sr-only" aria-live="polite" aria-atomic="true">
        {auditQuery.isError
          ? ''
          : isAuditLoading
            ? tCommon('loading')
            : t('audit.pagination.summary', { count: logs.length })}
      </output>
    </div>
  );
}

function DateFilterPicker({
  id,
  label,
  value,
  onChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function AuditLogRows({
  log,
  isExpanded,
  onToggle,
}: {
  readonly log: AuditLog;
  readonly isExpanded: boolean;
  readonly onToggle: () => void;
}) {
  const { i18n, t } = useTranslation('admin');
  const actorName = log.actor?.displayName || log.actor?.username || t('audit.unknownActor');
  const metadata = formatMetadata(log.metadata, t('audit.metadata.empty'));
  const dateLocale = getDateLocale(i18n.resolvedLanguage ?? i18n.language);
  const detailsId = `audit-log-details-${log.id}`;

  return (
    <>
      <TableRow>
        <TableCell className="text-sm text-muted-foreground">
          {new Intl.DateTimeFormat(dateLocale, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date(log.createdAt))}
        </TableCell>
        <TableCell>
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground">{actorName}</div>
            <div className="truncate text-xs text-muted-foreground">
              {log.actor?.email ?? t('audit.emptyValue')}
            </div>
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="outline">{log.action}</Badge>
        </TableCell>
        <TableCell className="text-sm">
          <div className="truncate font-mono text-xs text-foreground">{log.targetId}</div>
          <div className="text-xs text-muted-foreground">{log.targetType}</div>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {log.ipAddress ?? t('audit.emptyValue')}
        </TableCell>
        <TableCell className="text-right">
          <Button
            size="sm"
            variant="ghost"
            aria-controls={detailsId}
            aria-expanded={isExpanded}
            onClick={onToggle}
          >
            {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            {isExpanded ? t('audit.actions.collapse') : t('audit.actions.expand')}
          </Button>
        </TableCell>
      </TableRow>
      {isExpanded ? (
        <TableRow className="bg-muted/20 hover:bg-muted/20">
          <TableCell colSpan={6}>
            <div id={detailsId} className="rounded-lg border border-border/50 bg-background/70 p-4">
              <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                {t('audit.metadata.title')}
              </div>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md bg-black/40 p-3 font-mono text-xs leading-relaxed text-foreground">
                {metadata}
              </pre>
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

function toIsoDateTime(value: string, boundary: 'start' | 'end') {
  const date = parseDateValue(value);
  if (!date) {
    return undefined;
  }

  if (boundary === 'start') {
    date.setHours(0, 0, 0, 0);
  } else {
    date.setHours(23, 59, 59, 999);
  }

  return date.toISOString();
}

function formatMetadata(metadata: unknown, emptyLabel: string) {
  if (metadata === null || metadata === undefined) {
    return emptyLabel;
  }

  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return String(metadata);
  }
}

function getDateLocale(language: string | undefined) {
  return language?.startsWith('zh') ? 'zh-CN' : 'en-US';
}

function parseDateValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);

  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day
    ? date
    : null;
}
