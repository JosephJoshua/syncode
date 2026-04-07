import {
  CONTROL_API,
  type SessionHistoryParticipant,
  type SessionHistoryResponse,
  type SessionSummary,
  sessionHistoryResponseSchema,
} from '@syncode/contracts';
import { api } from '@/lib/api-client.js';
import i18n from '@/lib/i18n.js';

export type SessionRole = 'candidate' | 'interviewer' | 'observer';
export type SessionStatus = 'passed' | 'failed' | null;

export type SessionParticipant = {
  initials: string;
  isCurrentUser?: boolean;
};

export type SessionRow = {
  id: string;
  date: string;
  problemName: string;
  partner: SessionParticipant | null;
  observer: SessionParticipant | null;
  role: SessionRole;
  status: SessionStatus;
  score: number | null;
  durationMinutes: number;
};

export type DashboardStats = {
  totalSessions: string;
  passRate: string;
  averageScore: string;
  practiceTime: string;
};

export type SessionHistoryQuery = {
  cursor?: string;
  limit?: number;
  mode?: 'peer' | 'ai';
  fromDate?: string;
  toDate?: string;
  problemId?: string;
  sortBy?: 'createdAt' | 'finishedAt' | 'overallScore' | 'duration';
  sortOrder?: 'asc' | 'desc';
};

export type DashboardSessionHistory = {
  records: DashboardSessionRecord[];
  rows: SessionRow[];
  stats: DashboardStats;
};

export type DashboardSessionRecord = {
  id: string;
  roomId: string;
  mode: 'peer' | 'ai';
  problemName: string;
  difficulty: string | null;
  language: string | null;
  createdAt: string;
  finishedAt: string | null;
  durationSeconds: number;
  durationMinutes: number;
  score: number | null;
  hasReport: boolean;
  hasFeedback: boolean;
  viewerRole: SessionRole | null;
  role: SessionRole;
  status: SessionStatus;
  partner: SessionParticipant | null;
  observer: SessionParticipant | null;
};

export const EMPTY_DASHBOARD_STATS: DashboardStats = {
  totalSessions: '0',
  passRate: '--',
  averageScore: '--',
  practiceTime: '0h',
};

const MAX_PAGES = 10;

export async function fetchAllSessionHistory(query?: Omit<SessionHistoryQuery, 'cursor'>) {
  const allSessions: SessionSummary[] = [];
  let cursor: string | undefined;
  let hasMore = true;
  let pagesFetched = 0;
  let lastPagination: SessionHistoryResponse['pagination'] = {
    nextCursor: null,
    hasMore: false,
  };

  while (hasMore && pagesFetched < MAX_PAGES) {
    const response = await fetchSessionHistoryPage({
      limit: 100,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      ...query,
      cursor,
    });

    allSessions.push(...response.data);
    lastPagination = response.pagination;
    cursor = response.pagination.nextCursor ?? undefined;
    hasMore = response.pagination.hasMore && Boolean(cursor);
    pagesFetched++;
  }

  return {
    data: allSessions,
    pagination: lastPagination,
  };
}

export async function fetchDashboardSessionHistory(currentUserId: string) {
  const response = await fetchAllSessionHistory();

  return buildDashboardSessionHistory(response, currentUserId);
}

export function buildDashboardSessionHistory(
  response: SessionHistoryResponse,
  currentUserId: string | null,
): DashboardSessionHistory {
  const normalizedResponse = parseSessionHistoryResponse(response);
  const records = normalizedResponse.data.map((session) =>
    normalizeSessionSummary(session, currentUserId),
  );

  return {
    records,
    rows: records.map(toSessionRow),
    stats: buildDashboardStats(records),
  };
}

export function parseSessionHistoryResponse(response: unknown) {
  return sessionHistoryResponseSchema.parse(response);
}

export function buildDashboardStats(records: DashboardSessionRecord[]): DashboardStats {
  if (records.length === 0) {
    return EMPTY_DASHBOARD_STATS;
  }

  const scoredCandidateSessions = records.filter(
    (record) => record.viewerRole === 'candidate' && typeof record.score === 'number',
  );
  const passedCandidateSessions = scoredCandidateSessions.filter((record) => {
    if (record.score === null) {
      return false;
    }

    return record.score >= 60;
  });
  const totalDurationSeconds = records.reduce((total, record) => total + record.durationSeconds, 0);

  return {
    totalSessions: String(records.length),
    passRate:
      scoredCandidateSessions.length > 0
        ? `${Math.round((passedCandidateSessions.length / scoredCandidateSessions.length) * 100)}%`
        : '--',
    averageScore:
      scoredCandidateSessions.length > 0
        ? `${Math.round(
            scoredCandidateSessions.reduce((total, record) => total + (record.score ?? 0), 0) /
              scoredCandidateSessions.length,
          )}%`
        : '--',
    practiceTime: formatPracticeTime(totalDurationSeconds),
  };
}

export function normalizeSessionSummary(
  session: SessionSummary,
  currentUserId: string | null,
): DashboardSessionRecord {
  const viewerParticipant = currentUserId
    ? (session.participants.find((participant) => participant.userId === currentUserId) ?? null)
    : null;
  const viewerRole = toDashboardRole(viewerParticipant?.role);
  const displayRole = viewerRole ?? 'observer';
  const interviewer = findParticipantByRole(session.participants, 'interviewer');
  const candidate = findParticipantByRole(session.participants, 'candidate');
  const observer = findParticipantByRole(session.participants, 'observer');

  return {
    id: session.sessionId,
    roomId: session.roomId,
    mode: session.mode,
    problemName: session.problemTitle ?? i18n.t('common:untitledProblem'),
    difficulty: session.difficulty,
    language: session.language,
    createdAt: session.createdAt,
    finishedAt: session.finishedAt,
    durationSeconds: session.duration,
    durationMinutes: Math.max(1, Math.round(session.duration / 60)),
    score: session.overallScore,
    hasReport: session.hasReport,
    hasFeedback: session.hasFeedback,
    viewerRole,
    role: displayRole,
    status: getSessionStatus(viewerRole, session.overallScore),
    partner:
      viewerRole === 'candidate'
        ? toSessionParticipant(interviewer, currentUserId)
        : viewerRole === 'interviewer'
          ? toSessionParticipant(candidate, currentUserId)
          : null,
    observer:
      viewerRole === 'observer'
        ? toSessionParticipant(viewerParticipant, currentUserId)
        : toSessionParticipant(observer, currentUserId),
  };
}

export function toSessionRow(record: DashboardSessionRecord): SessionRow {
  return {
    id: record.id,
    date: record.finishedAt ?? record.createdAt,
    problemName: record.problemName,
    partner: record.partner,
    observer: record.observer,
    role: record.role,
    status: record.status,
    score: record.score,
    durationMinutes: record.durationMinutes,
  };
}

async function fetchSessionHistoryPage(query: SessionHistoryQuery) {
  const response = await api(CONTROL_API.SESSIONS.LIST, {
    searchParams: query,
  });

  return parseSessionHistoryResponse(response);
}

function getSessionStatus(role: SessionRole | null, overallScore: number | null) {
  if (role !== 'candidate' || overallScore === null) {
    return null;
  }

  return overallScore >= 60 ? 'passed' : 'failed';
}

function toDashboardRole(role: string | null | undefined): SessionRole | null {
  if (role === 'candidate' || role === 'interviewer' || role === 'observer') {
    return role;
  }

  return null;
}

function findParticipantByRole(participants: SessionHistoryParticipant[], role: SessionRole) {
  return participants.find((participant) => participant.role === role) ?? null;
}

function toSessionParticipant(
  participant: SessionHistoryParticipant | null,
  currentUserId: string | null,
): SessionParticipant | null {
  if (!participant) {
    return null;
  }

  return {
    initials: getParticipantInitials(participant),
    isCurrentUser: currentUserId ? participant.userId === currentUserId : false,
  };
}

function getParticipantInitials(participant: SessionHistoryParticipant) {
  const source = participant.displayName?.trim() || participant.username?.trim() || '??';
  const words = source.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return '??';
  }

  if (words.length === 1) {
    return (words[0] ?? '??').slice(0, 2).toUpperCase();
  }

  const first = words[0] ?? '';
  const second = words[1] ?? '';

  return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase();
}

function formatPracticeTime(totalDurationSeconds: number) {
  const roundedHours = Math.round((totalDurationSeconds / 3600) * 10) / 10;

  return `${roundedHours.toFixed(1).replace(/\.0$/, '')}h`;
}
