import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  cn,
  Input,
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
import { Link } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  SessionParticipant,
  SessionRole,
  SessionRow,
  SessionStatus,
} from '@/lib/dashboard-session-history';
import { getUserInitial } from '@/lib/user-utils';
import { useAuthStore } from '@/stores/auth.store';

type SessionFilter = 'all' | 'passed' | 'failed';
type SessionSort = 'date-desc' | 'date-asc' | 'score-desc' | 'score-asc' | 'duration-desc';

const MONTH_LABELS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];

function formatSessionDate(date: string) {
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return `${parsed.getFullYear()} ${MONTH_LABELS[parsed.getMonth()]} ${String(parsed.getDate()).padStart(2, '0')}`;
}

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
    return b.durationMinutes - a.durationMinutes;
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
  participant: SessionParticipant | null;
  currentUserInitial: string;
}) {
  if (!participant) {
    return <span className="text-muted-foreground">-</span>;
  }

  const initials =
    participant.isCurrentUser && currentUserInitial ? currentUserInitial : participant.initials;

  return (
    <Avatar className="mx-auto size-8">
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}

export function DashboardRecentSessions({
  rows,
  isLoading = false,
  isError = false,
  isUnavailable = false,
  onRetry,
}: {
  rows: SessionRow[];
  isLoading?: boolean;
  isError?: boolean;
  isUnavailable?: boolean;
  onRetry?: () => void;
}) {
  const { t } = useTranslation('dashboard');
  const user = useAuthStore((state) => state.user);
  const currentUserInitial = getUserInitial(user) || 'U';
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [filter, setFilter] = useState<SessionFilter>('all');
  const [sortBy, setSortBy] = useState<SessionSort>('date-desc');

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

  const hasBaseRows = baseRows.length > 0;
  const hasVisibleRows = filteredRows.length > 0;

  return (
    <section className="mt-10 sm:mt-12">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <h2 className="shrink-0 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {t('recentSessions')}
        </h2>

        <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center xl:justify-end xl:gap-4">
          <div className="relative w-full md:min-w-[320px] md:flex-1 xl:max-w-100">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('search.placeholder')}
              className="h-11 pl-9"
            />
          </div>

          <Select value={filter} onValueChange={(value) => setFilter(value as SessionFilter)}>
            <SelectTrigger className="w-full md:w-42.5 xl:flex-none" aria-label="Filter sessions">
              <SelectValue placeholder={t('filter.all')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filter.all')}</SelectItem>
              <SelectItem value="passed">{t('filter.passedOnly')}</SelectItem>
              <SelectItem value="failed">{t('filter.failedOnly')}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SessionSort)}>
            <SelectTrigger className="w-full md:w-57.5 xl:flex-none" aria-label="Sort sessions">
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-muted-foreground">
                    {formatSessionDate(row.date)}
                  </TableCell>
                  <TableCell>
                    <Link
                      to="/sessions/$sessionId/feedback"
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
                    <Badge variant={getRoleBadgeVariant(row.role)} className="capitalize">
                      {row.role}
                    </Badge>
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
                    {row.durationMinutes}m
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
      </Card>
    </section>
  );
}
