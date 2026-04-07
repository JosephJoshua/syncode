import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ERROR_CODES, type ListSessionsQuery, SESSIONS_SORT_BY_OPTIONS } from '@syncode/contracts';
import type { Database } from '@syncode/db';
import {
  peerFeedback,
  problems,
  runs,
  sessionDeletions,
  sessionParticipants,
  sessionRecordings,
  sessionReports,
  sessions,
  submissions,
  users,
} from '@syncode/db';
import { type PaginatedResult, paginate } from '@syncode/shared/server';
import { and, asc, type Column, desc, eq, gt, gte, inArray, lt, lte, or, sql } from 'drizzle-orm';
import { DB_CLIENT } from '@/modules/db/db.module';
import type { SessionDetailResult, SessionSummaryResult } from './sessions.types.js';

type SortBy = (typeof SESSIONS_SORT_BY_OPTIONS)[number];

/** Sentinel value encoded in cursor for nullable sort fields. */
const NULL_SENTINEL = '\x01NULL';
const TERMINAL_STATUSES = ['completed', 'failed'] as const;

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(@Inject(DB_CLIENT) private readonly db: Database) {}

  async listSessions(
    userId: string,
    query: ListSessionsQuery,
    isAdmin: boolean,
  ): Promise<PaginatedResult<SessionSummaryResult>> {
    const sortDir = query.sortOrder === 'asc' ? asc : desc;
    const compareOp = query.sortOrder === 'asc' ? gt : lt;

    return paginate<SessionSummaryResult>({
      cursor: query.cursor,
      limit: query.limit,
      getCursorValues: (row) => [this.getSortValue(row, query.sortBy), row.sessionId],
      fetchPage: async (decoded, fetchLimit) => {
        const conditions = [eq(sessions.status, 'finished')];

        if (!isAdmin) {
          conditions.push(
            sql`EXISTS (
              SELECT 1 FROM session_participants sp
              WHERE sp.session_id = ${sessions.id} AND sp.user_id = ${userId}
            )`,
            sql`NOT EXISTS (
              SELECT 1 FROM session_deletions sd
              WHERE sd.session_id = ${sessions.id} AND sd.user_id = ${userId}
            )`,
          );
        }

        if (query.mode) conditions.push(eq(sessions.mode, query.mode));
        if (query.problemId) conditions.push(eq(sessions.problemId, query.problemId));
        if (query.fromDate) conditions.push(gte(sessions.startedAt, new Date(query.fromDate)));
        if (query.toDate) conditions.push(lte(sessions.startedAt, new Date(query.toDate)));

        if (decoded?.length === 2 && decoded[0] && decoded[1]) {
          const [cursorSort, cursorId] = decoded;
          const cursorCondition = this.buildCursorCondition(
            query.sortBy,
            cursorSort,
            cursorId,
            compareOp,
          );
          if (cursorCondition) {
            conditions.push(cursorCondition);
          }
        }

        const sortColumn = this.getSortColumn(query.sortBy);

        const baseQuery = this.db
          .select({
            sessionId: sessions.id,
            roomId: sessions.roomId,
            mode: sessions.mode,
            problemTitle: problems.title,
            difficulty: problems.difficulty,
            language: sessions.language,
            durationMs: sessions.durationMs,
            overallScore: sessionReports.overallScore,
            hasReport: sql<boolean>`${sessionReports.id} IS NOT NULL`.as('has_report'),
            hasFeedback: sql<boolean>`EXISTS (
              SELECT 1 FROM peer_feedback pf
              WHERE pf.session_id = ${sessions.id}
            )`.as('has_feedback'),
            createdAt: sessions.startedAt,
            finishedAt: sessions.finishedAt,
          })
          .from(sessions)
          .leftJoin(problems, eq(problems.id, sessions.problemId))
          .leftJoin(sessionReports, eq(sessionReports.sessionId, sessions.id));

        const orderExpressions = this.isNullableSortColumn(query.sortBy)
          ? [
              query.sortOrder === 'asc'
                ? sql`${sortColumn} ASC NULLS LAST`
                : sql`${sortColumn} DESC NULLS LAST`,
              sortDir(sessions.id),
            ]
          : [sortDir(sortColumn), sortDir(sessions.id)];

        const rows = await baseQuery
          .where(and(...conditions))
          .orderBy(...orderExpressions)
          .limit(fetchLimit);

        const sessionIds = rows.map((r) => r.sessionId);
        const participantRows =
          sessionIds.length > 0
            ? await this.db
                .select({
                  sessionId: sessionParticipants.sessionId,
                  userId: sessionParticipants.userId,
                  username: users.username,
                  displayName: users.displayName,
                  avatarUrl: users.avatarUrl,
                  role: sessionParticipants.role,
                })
                .from(sessionParticipants)
                .innerJoin(users, eq(users.id, sessionParticipants.userId))
                .where(inArray(sessionParticipants.sessionId, sessionIds))
            : [];

        const participantsBySession = new Map<string, typeof participantRows>();
        for (const p of participantRows) {
          const existing = participantsBySession.get(p.sessionId) ?? [];
          existing.push(p);
          participantsBySession.set(p.sessionId, existing);
        }

        return rows.map((row) => ({
          sessionId: row.sessionId,
          roomId: row.roomId,
          mode: row.mode,
          problemTitle: row.problemTitle ?? null,
          difficulty: row.difficulty ?? null,
          language: row.language,
          duration: Math.round((row.durationMs ?? 0) / 1000),
          durationMs: row.durationMs ?? 0,
          participants: (participantsBySession.get(row.sessionId) ?? []).map((p) => ({
            userId: p.userId,
            username: p.username,
            displayName: p.displayName,
            avatarUrl: p.avatarUrl,
            role: p.role,
          })),
          overallScore: row.overallScore ?? null,
          hasReport: row.hasReport,
          hasFeedback: row.hasFeedback,
          createdAt: row.createdAt,
          finishedAt: row.finishedAt,
        }));
      },
    });
  }

  async getSession(
    sessionId: string,
    userId: string,
    isAdmin: boolean,
  ): Promise<SessionDetailResult> {
    const [session] = await this.db
      .select({
        id: sessions.id,
        roomId: sessions.roomId,
        problemId: sessions.problemId,
        mode: sessions.mode,
        language: sessions.language,
        durationMs: sessions.durationMs,
        startedAt: sessions.startedAt,
        finishedAt: sessions.finishedAt,
      })
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.status, 'finished')));

    if (!session) {
      throw new NotFoundException({
        message: 'Session not found',
        code: ERROR_CODES.SESSION_NOT_FOUND,
      });
    }

    if (!isAdmin) {
      await Promise.all([
        this.assertParticipant(sessionId, userId),
        this.assertNotSoftDeleted(sessionId, userId),
      ]);
    }

    const [
      participantRows,
      report,
      feedbackExists,
      recordingExists,
      runRows,
      submissionRows,
      problemRow,
    ] = await Promise.all([
      this.db
        .select({
          userId: sessionParticipants.userId,
          username: users.username,
          displayName: users.displayName,
          role: sessionParticipants.role,
          joinedAt: sessionParticipants.joinedAt,
          leftAt: sessionParticipants.leftAt,
        })
        .from(sessionParticipants)
        .innerJoin(users, eq(users.id, sessionParticipants.userId))
        .where(eq(sessionParticipants.sessionId, sessionId)),
      this.db.query.sessionReports.findFirst({
        columns: { id: true },
        where: (table, { eq }) => eq(table.sessionId, sessionId),
      }),
      this.db
        .select({ id: peerFeedback.id })
        .from(peerFeedback)
        .where(eq(peerFeedback.sessionId, sessionId))
        .limit(1),
      this.db
        .select({ id: sessionRecordings.id })
        .from(sessionRecordings)
        .where(eq(sessionRecordings.sessionId, sessionId))
        .limit(1),
      this.db
        .select({
          jobId: runs.jobId,
          status: runs.status,
          createdAt: runs.createdAt,
        })
        .from(runs)
        .where(and(eq(runs.roomId, session.roomId), inArray(runs.status, TERMINAL_STATUSES)))
        .orderBy(asc(runs.createdAt)),
      this.db
        .select({
          submissionId: submissions.id,
          status: submissions.status,
          passed: submissions.passedTestCases,
          total: submissions.totalTestCases,
          createdAt: submissions.submittedAt,
        })
        .from(submissions)
        .where(
          and(
            eq(submissions.roomId, session.roomId),
            inArray(submissions.status, TERMINAL_STATUSES),
          ),
        )
        .orderBy(asc(submissions.submittedAt)),
      session.problemId
        ? this.db
            .select({ id: problems.id, title: problems.title, difficulty: problems.difficulty })
            .from(problems)
            .where(eq(problems.id, session.problemId))
        : Promise.resolve([]),
    ]);

    return {
      sessionId: session.id,
      roomId: session.roomId,
      mode: session.mode,
      problem: problemRow[0] ?? null,
      language: session.language,
      duration: Math.round((session.durationMs ?? 0) / 1000),
      participants: participantRows.map((p) => ({
        userId: p.userId,
        username: p.username,
        displayName: p.displayName,
        role: p.role,
        joinedAt: p.joinedAt,
        leftAt: p.leftAt,
      })),
      runs: runRows.map((r) => ({
        jobId: r.jobId,
        status: r.status as 'completed' | 'failed',
        createdAt: r.createdAt,
      })),
      submissions: submissionRows.map((s) => ({
        submissionId: s.submissionId,
        status: s.status as 'completed' | 'failed',
        passed: s.passed,
        total: s.total,
        createdAt: s.createdAt,
      })),
      hasReport: report != null,
      hasFeedback: feedbackExists.length > 0,
      hasRecording: recordingExists.length > 0,
      createdAt: session.startedAt,
      finishedAt: session.finishedAt,
    };
  }

  async deleteSession(sessionId: string, userId: string, isAdmin: boolean): Promise<void> {
    const [session] = await this.db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.id, sessionId));

    if (!session) {
      throw new NotFoundException({
        message: 'Session not found',
        code: ERROR_CODES.SESSION_NOT_FOUND,
      });
    }

    if (!isAdmin) {
      await this.assertParticipant(sessionId, userId);
    }

    await this.db.insert(sessionDeletions).values({ sessionId, userId }).onConflictDoNothing();

    this.logger.log(`User ${userId} soft-deleted session ${sessionId}`);
  }

  async isAdmin(userId: string): Promise<boolean> {
    const user = await this.db.query.users.findFirst({
      columns: { role: true },
      where: (table, { eq }) => eq(table.id, userId),
    });
    return user?.role === 'admin';
  }

  private async assertParticipant(sessionId: string, userId: string): Promise<void> {
    const participant = await this.db.query.sessionParticipants.findFirst({
      columns: { userId: true },
      where: (table, { and, eq }) => and(eq(table.sessionId, sessionId), eq(table.userId, userId)),
    });

    if (!participant) {
      throw new ForbiddenException({
        message: 'Not a participant of this session',
        code: ERROR_CODES.SESSION_NOT_PARTICIPANT,
      });
    }
  }

  private async assertNotSoftDeleted(sessionId: string, userId: string): Promise<void> {
    const deletion = await this.db.query.sessionDeletions.findFirst({
      columns: { sessionId: true },
      where: (table, { and, eq }) => and(eq(table.sessionId, sessionId), eq(table.userId, userId)),
    });

    if (deletion) {
      throw new NotFoundException({
        message: 'Session not found',
        code: ERROR_CODES.SESSION_NOT_FOUND,
      });
    }
  }

  /**
   * Build a keyset cursor condition using typed Drizzle operators.
   * Handles nullable columns by treating NULL_SENTINEL as "sort value is null".
   */
  private buildCursorCondition(
    sortBy: SortBy,
    cursorSort: string,
    cursorId: string,
    compareOp: typeof gt | typeof lt,
  ) {
    const sortColumn = this.getSortColumn(sortBy);
    const isNullCursor = cursorSort === NULL_SENTINEL;

    if (isNullCursor) {
      return and(sql`${sortColumn} IS NULL`, compareOp(sessions.id, cursorId));
    }

    if (sortBy === 'overallScore' || sortBy === 'duration') {
      const cursorNum = Number(cursorSort);
      if (Number.isNaN(cursorNum)) return null;
      const compareValue = cursorNum;
      return or(
        compareOp(sortColumn as Column, compareValue),
        and(eq(sortColumn as Column, compareValue), compareOp(sessions.id, cursorId)),
      );
    }

    const cursorDate = new Date(cursorSort);
    if (Number.isNaN(cursorDate.getTime())) return null;
    const col = sortBy === 'finishedAt' ? sessions.finishedAt : sessions.startedAt;
    return or(
      compareOp(col as Column, cursorDate),
      and(eq(col as Column, cursorDate), compareOp(sessions.id, cursorId)),
    );
  }

  private getSortValue(row: SessionSummaryResult, sortBy: SortBy): string {
    switch (sortBy) {
      case 'finishedAt':
        return row.finishedAt?.toISOString() ?? NULL_SENTINEL;
      case 'overallScore':
        return row.overallScore == null ? NULL_SENTINEL : String(row.overallScore);
      case 'duration':
        return String(row.durationMs);
      default:
        return row.createdAt.toISOString();
    }
  }

  private getSortColumn(sortBy: SortBy) {
    switch (sortBy) {
      case 'finishedAt':
        return sessions.finishedAt;
      case 'overallScore':
        return sessionReports.overallScore;
      case 'duration':
        return sessions.durationMs;
      default:
        return sessions.startedAt;
    }
  }

  private isNullableSortColumn(sortBy: SortBy): boolean {
    return sortBy === 'overallScore' || sortBy === 'finishedAt' || sortBy === 'duration';
  }
}
