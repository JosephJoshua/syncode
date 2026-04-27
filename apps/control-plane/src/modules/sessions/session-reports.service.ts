import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AI_CLIENT,
  ERROR_CODES,
  type GenerateSessionReportResult,
  type IAiClient,
  type SessionReport,
} from '@syncode/contracts';
import type { Database } from '@syncode/db';
import { problems, sessionParticipants, sessionReports, users } from '@syncode/db';
import { CACHE_SERVICE, type ICacheService } from '@syncode/shared/ports';
import { and, asc, eq } from 'drizzle-orm';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import { SessionReportRequestBuilderService } from './session-report-request-builder.service.js';
import { SessionsService } from './sessions.service.js';

const SESSION_REPORT_META_KEY_PREFIX = 'session-report-meta:';
const SESSION_REPORT_META_TTL_SECONDS = 24 * 60 * 60;

interface SessionReportJobMeta {
  sessionId: string;
  userId: string;
}

@Injectable()
export class SessionReportsService {
  private readonly logger = new Logger(SessionReportsService.name);

  constructor(
    @Inject(DB_CLIENT) private readonly db: Database,
    @Inject(AI_CLIENT) private readonly aiClient: IAiClient,
    @Inject(CACHE_SERVICE) private readonly cacheService: ICacheService,
    private readonly sessionsService: SessionsService,
    private readonly requestBuilder: SessionReportRequestBuilderService,
  ) {}

  async enqueueForFinishedSession(sessionId: string): Promise<void> {
    const sessionRow = await this.db.query.sessions.findFirst({
      columns: {
        id: true,
        roomId: true,
        problemId: true,
        mode: true,
        language: true,
        status: true,
        durationMs: true,
        startedAt: true,
        finishedAt: true,
      },
      where: (table, { eq }) => eq(table.id, sessionId),
    });

    if (!sessionRow) {
      this.logger.warn(`Skipping report generation for missing session ${sessionId}`);
      return;
    }

    if (sessionRow.status !== 'finished') {
      this.logger.warn(`Skipping report generation for non-finished session ${sessionId}`);
      return;
    }

    const [problemRow] = sessionRow.problemId
      ? await this.db
          .select({
            id: problems.id,
            title: problems.title,
            description: problems.description,
            difficulty: problems.difficulty,
            constraints: problems.constraints,
          })
          .from(problems)
          .where(eq(problems.id, sessionRow.problemId))
          .limit(1)
      : [];

    const participants = await this.db
      .select({
        userId: sessionParticipants.userId,
        username: users.username,
        displayName: users.displayName,
        role: sessionParticipants.role,
      })
      .from(sessionParticipants)
      .innerJoin(users, eq(users.id, sessionParticipants.userId))
      .where(eq(sessionParticipants.sessionId, sessionId))
      .orderBy(asc(sessionParticipants.joinedAt), asc(sessionParticipants.userId));

    if (participants.length === 0) {
      this.logger.warn(`Skipping report generation for session ${sessionId}: no participants`);
      return;
    }

    await Promise.all(
      participants.map(async (participant) => {
        const request = await this.requestBuilder.buildReportRequest(
          sessionRow,
          participants,
          participant,
          problemRow ?? null,
        );
        await this.enqueueParticipantReport(request.sessionId, request.participantId, request);
      }),
    );
  }

  async handleResult(jobId: string, result: GenerateSessionReportResult): Promise<void> {
    const metaKey = `${SESSION_REPORT_META_KEY_PREFIX}${jobId}`;
    const meta = await this.cacheService.get<SessionReportJobMeta>(metaKey);

    if (!meta) {
      this.logger.warn(`No metadata for session-report job ${jobId}, skipping DB persistence`);
      return;
    }

    const { model, ...reportPayload } = result;
    const generatedAt = result.generatedAt ? new Date(result.generatedAt) : new Date();

    await this.db
      .update(sessionReports)
      .set({
        status: 'completed',
        overallScore: result.overallScore ?? null,
        report: reportPayload,
        model: model ?? null,
        errorMessage: null,
        generatedAt,
      })
      .where(
        and(eq(sessionReports.sessionId, meta.sessionId), eq(sessionReports.userId, meta.userId)),
      );

    await this.cacheService.del(metaKey);

    this.logger.debug(
      `Persisted session report for session ${meta.sessionId} and user ${meta.userId}`,
    );
  }

  async getReport(sessionId: string, userId: string, isAdmin: boolean): Promise<SessionReport> {
    await this.sessionsService.assertSessionAccessible(sessionId, userId, isAdmin);

    const row = await this.db.query.sessionReports.findFirst({
      columns: { report: true, generatedAt: true },
      where: (table, { and, eq }) =>
        and(
          eq(table.sessionId, sessionId),
          eq(table.userId, userId),
          eq(table.status, 'completed'),
        ),
    });

    if (!row?.report) {
      throw new NotFoundException({
        message: 'Session report not yet generated',
        code: ERROR_CODES.SESSION_REPORT_NOT_READY,
      });
    }

    const report = row.report as SessionReport;
    return {
      ...report,
      sessionId: report.sessionId ?? sessionId,
      generatedAt: report.generatedAt ?? row.generatedAt?.toISOString(),
    };
  }

  private async enqueueParticipantReport(
    sessionId: string,
    userId: string,
    request: Parameters<IAiClient['submitSessionReportRequest']>[0],
  ): Promise<void> {
    const requestedAt = new Date();

    await this.db
      .insert(sessionReports)
      .values({
        sessionId,
        userId,
        status: 'pending',
        requestedAt,
        generatedAt: null,
        overallScore: null,
        report: null,
        model: null,
        errorMessage: null,
      })
      .onConflictDoUpdate({
        target: [sessionReports.sessionId, sessionReports.userId],
        set: {
          status: 'pending',
          requestedAt,
          generatedAt: null,
          overallScore: null,
          report: null,
          model: null,
          errorMessage: null,
        },
      });

    try {
      const { jobId } = await this.aiClient.submitSessionReportRequest(request);
      await this.cacheService.set<SessionReportJobMeta>(
        `${SESSION_REPORT_META_KEY_PREFIX}${jobId}`,
        { sessionId, userId },
        SESSION_REPORT_META_TTL_SECONDS,
      );
    } catch (error) {
      await this.db
        .update(sessionReports)
        .set({
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown AI submission failure',
        })
        .where(and(eq(sessionReports.sessionId, sessionId), eq(sessionReports.userId, userId)));

      throw error;
    }
  }
}
