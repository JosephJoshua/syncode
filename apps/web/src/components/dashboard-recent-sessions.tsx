import type { AuthUserResponse } from '@syncode/contracts';
import {
  Avatar,
  AvatarFallback,
  Badge,
  Card,
  cn,
  Input,
  Select,
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
import {
  MOCK_SESSION_ROWS,
  type SessionParticipant,
  type SessionRole,
  type SessionRow,
  type SessionStatus,
} from '@/lib/session-history.mock';
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

function getUserInitial(user: AuthUserResponse | null) {
  const source = user?.displayName || user?.username || user?.email;

  if (!source) {
    return null;
  }

  return source.trim().charAt(0).toUpperCase() || null;
}

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

export function DashboardRecentSessions() {
  const user = useAuthStore((state) => state.user);
  const currentUserInitial = getUserInitial(user) || 'U';
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [filter, setFilter] = useState<SessionFilter>('all');
  const [sortBy, setSortBy] = useState<SessionSort>('date-desc');

  const normalizedQuery = deferredSearchQuery.trim().toLowerCase();

  const baseRows = MOCK_SESSION_ROWS.map((row) => {
    if (row.observer?.isCurrentUser) {
      return {
        ...row,
        partner: null,
        observer: {
          ...row.observer,
          initials: currentUserInitial,
        },
      };
    }

    return row;
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          Recent Sessions
        </h2>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:justify-end">
          <div className="relative w-full sm:w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by problem name"
              className="h-11 pl-9"
            />
          </div>

          <Select
            value={filter}
            onChange={(event) => setFilter(event.target.value as SessionFilter)}
            className="min-w-[140px]"
            aria-label="Filter sessions"
          >
            <option value="all">All sessions</option>
            <option value="passed">Passed only</option>
            <option value="failed">Failed only</option>
          </Select>

          <Select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SessionSort)}
            className="min-w-[220px]"
            aria-label="Sort sessions"
          >
            <option value="date-desc">Date: Newest first</option>
            <option value="date-asc">Date: Oldest first</option>
            <option value="score-desc">Score: High to low</option>
            <option value="score-asc">Score: Low to high</option>
            <option value="duration-desc">Duration</option>
          </Select>
        </div>
      </div>

      <Card className="mt-5 gap-0 overflow-hidden border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
        {hasVisibleRows ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[140px] text-center">Date</TableHead>
                <TableHead className="min-w-[260px] text-center">Problem</TableHead>
                <TableHead className="w-[88px] text-center">Partner</TableHead>
                <TableHead className="w-[96px] text-center">Observer</TableHead>
                <TableHead className="w-[120px] text-center">Role</TableHead>
                <TableHead className="w-[120px] text-center">Status</TableHead>
                <TableHead className="w-[90px] text-center">Score</TableHead>
                <TableHead className="w-[100px] text-center">Duration</TableHead>
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
                        {row.status === 'passed' ? 'Pass' : 'Failed'}
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
              {hasBaseRows ? 'No matching sessions' : 'No sessions yet'}
            </h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {hasBaseRows
                ? 'Try adjusting your search, filter, or sort settings to surface more session history.'
                : 'Your completed interview practices will appear here once you start training.'}
            </p>
          </div>
        )}
      </Card>
    </section>
  );
}
