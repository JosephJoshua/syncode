import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AI_CLIENT,
  COLLAB_CLIENT,
  ERROR_CODES,
  type GenerateSessionReportRequest,
  type GenerateSessionReportResult,
  type GenerateWeaknessAnalysisResult,
  type IAiClient,
  type ICollabClient,
  type SessionReport,
  type SessionReportDimension,
  USER_WEAKNESS_CATEGORIES,
} from '@syncode/contracts';
import type { Database } from '@syncode/db';
import {
  problems,
  sessionDeletions,
  sessionParticipants,
  sessionReports,
  sessions,
  users,
  userWeaknesses,
  weaknessSessions,
} from '@syncode/db';
import { CACHE_SERVICE, type ICacheService } from '@syncode/shared/ports';
import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import { SessionReportRequestBuilderService } from './session-report-request-builder.service.js';
import { SessionsService } from './sessions.service.js';

const SESSION_REPORT_META_KEY_PREFIX = 'session-report-meta:';
const WEAKNESS_ANALYSIS_META_KEY_PREFIX = 'weakness-analysis-meta:';
const SESSION_REPORT_META_TTL_SECONDS = 24 * 60 * 60;
const WEAKNESS_ANALYSIS_META_TTL_SECONDS = 24 * 60 * 60;
const WEAKNESS_SCORE_THRESHOLD = 85;
const PRIOR_TREND_DELTA = 3;
const RECENT_REPORT_LIMIT = 5;
const SESSION_REPORT_CHAT_HISTORY_LIMIT = 200;

type WeaknessCategory = (typeof USER_WEAKNESS_CATEGORIES)[number];
type WeaknessTrend = 'improving' | 'stable' | 'worsening';
type ReportDimensionKey =
  | 'correctness'
  | 'efficiency'
  | 'codeQuality'
  | 'communication'
  | 'problemSolving';

interface WeaknessSignal {
  category: WeaknessCategory;
  dimension: ReportDimensionKey;
  score: number;
  description: string;
}

interface WeaknessPersistenceRecord {
  category: WeaknessCategory;
  description: string;
  sessionDescription?: string | null;
  trend: WeaknessTrend;
  score: number | null;
}

interface SessionReportJobMeta {
  sessionId: string;
  userId: string;
  requestedAt: string;
}

interface WeaknessAnalysisJobMeta {
  sessionId: string;
  userId: string;
  reportedAt: string;
}

@Injectable()
export class SessionReportsService {
  private readonly logger = new Logger(SessionReportsService.name);

  constructor(
    @Inject(DB_CLIENT) private readonly db: Database,
    @Inject(AI_CLIENT) private readonly aiClient: IAiClient,
    @Inject(COLLAB_CLIENT) private readonly collabClient: ICollabClient,
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

    const candidates = participants.filter((participant) => participant.role === 'candidate');

    if (candidates.length === 0) {
      this.logger.warn(`Skipping report generation for session ${sessionId}: no candidate`);
      return;
    }

    const roomChatMessages = await this.loadSessionReportChatMessages(
      sessionRow.roomId,
      participants,
    );

    await Promise.all(
      candidates.map(async (participant) => {
        const request = await this.requestBuilder.buildReportRequest(
          sessionRow,
          participants,
          participant,
          problemRow ?? null,
          roomChatMessages,
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

    if (!(await this.isCurrentSessionReportGeneration(meta))) {
      this.logger.warn(`Stale session-report job ${jobId}, skipping DB persistence`);
      await this.cacheService.del(metaKey);
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

    const weaknessAnalysisRequest = await this.buildWeaknessAnalysisRequest(
      meta.sessionId,
      meta.userId,
      reportPayload,
      generatedAt,
    );
    await this.persistWeaknessSignals(meta.sessionId, meta.userId, reportPayload, generatedAt);
    await this.enqueueWeaknessAnalysis(
      meta.sessionId,
      meta.userId,
      weaknessAnalysisRequest,
      generatedAt,
    );

    await this.cacheService.del(metaKey);

    this.logger.debug(
      `Persisted session report for session ${meta.sessionId} and user ${meta.userId}`,
    );
  }

  private async isCurrentSessionReportGeneration(meta: SessionReportJobMeta): Promise<boolean> {
    const row = await this.db.query.sessionReports.findFirst({
      columns: { requestedAt: true },
      where: (table, { and, eq }) =>
        and(eq(table.sessionId, meta.sessionId), eq(table.userId, meta.userId)),
    });

    return row?.requestedAt?.toISOString() === meta.requestedAt;
  }

  async handleWeaknessAnalysisResult(
    jobId: string,
    result: GenerateWeaknessAnalysisResult,
  ): Promise<void> {
    const metaKey = `${WEAKNESS_ANALYSIS_META_KEY_PREFIX}${jobId}`;
    const meta = await this.cacheService.get<WeaknessAnalysisJobMeta>(metaKey);

    const context = meta ?? {
      sessionId: result.sessionId,
      userId: result.participantId,
      reportedAt: result.reportedAt,
    };

    if (!(await this.isCurrentWeaknessAnalysisGeneration(context))) {
      this.logger.warn(`Stale weakness-analysis job ${jobId}, skipping DB persistence`);
      if (meta) {
        await this.cacheService.del(metaKey);
      }
      return;
    }

    await this.persistWeaknessAnalysisResult(
      context.sessionId,
      context.userId,
      result,
      new Date(context.reportedAt),
    );
    if (meta) {
      await this.cacheService.del(metaKey);
    }

    this.logger.debug(
      `Persisted weakness analysis for session ${context.sessionId} and user ${context.userId}`,
    );
  }

  private async isCurrentWeaknessAnalysisGeneration(
    meta: WeaknessAnalysisJobMeta,
  ): Promise<boolean> {
    const row = await this.db.query.sessionReports.findFirst({
      columns: { generatedAt: true, status: true },
      where: (table, { and, eq }) =>
        and(
          eq(table.sessionId, meta.sessionId),
          eq(table.userId, meta.userId),
          eq(table.status, 'completed'),
        ),
    });

    return row?.generatedAt?.toISOString() === meta.reportedAt;
  }

  async getReport(sessionId: string, userId: string, isAdmin: boolean): Promise<SessionReport> {
    await this.sessionsService.assertSessionAccessible(sessionId, userId, isAdmin);

    const row = await this.db.query.sessionReports.findFirst({
      columns: { report: true, generatedAt: true, status: true },
      where: (table, { and, eq }) => and(eq(table.sessionId, sessionId), eq(table.userId, userId)),
    });

    if (row?.status === 'completed' && row.report) {
      const report = row.report as SessionReport;
      return {
        ...report,
        sessionId: report.sessionId ?? sessionId,
        generatedAt: report.generatedAt ?? row.generatedAt?.toISOString(),
      };
    }

    if (row) {
      throw new NotFoundException({
        message: 'Session report not yet generated',
        code: ERROR_CODES.SESSION_REPORT_NOT_READY,
      });
    }

    const participant = await this.db.query.sessionParticipants.findFirst({
      columns: { role: true },
      where: (table, { and, eq }) => and(eq(table.sessionId, sessionId), eq(table.userId, userId)),
    });

    if (participant?.role !== 'candidate') {
      throw new NotFoundException({
        message: 'Session report is only generated for the candidate',
        code: ERROR_CODES.SESSION_REPORT_UNAVAILABLE,
      });
    }

    throw new NotFoundException({
      message: 'Session report not yet generated',
      code: ERROR_CODES.SESSION_REPORT_NOT_READY,
    });
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
        { sessionId, userId, requestedAt: requestedAt.toISOString() },
        SESSION_REPORT_META_TTL_SECONDS,
      );
      const cachedResult = await this.aiClient.getSessionReportResult(jobId);
      if (cachedResult) {
        await this.handleResult(jobId, cachedResult);
      }
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

  private async loadSessionReportChatMessages(
    roomId: string,
    participants: Array<{
      userId: string;
      username: string;
      displayName: string | null;
      role: 'interviewer' | 'candidate' | 'observer';
    }>,
  ): Promise<NonNullable<GenerateSessionReportRequest['roomChatMessages']>> {
    try {
      const chatHistory = await this.collabClient.getRoomChatHistory(roomId, {
        limit: SESSION_REPORT_CHAT_HISTORY_LIMIT,
      });

      const participantByUserId = new Map(
        participants.map((participant) => [participant.userId, participant]),
      );

      return chatHistory.messages
        .filter((message) => message.text.trim().length > 0 || message.attachments.length > 0)
        .map((message) => {
          const participant = participantByUserId.get(message.userId);
          const identity = participant
            ? (participant.displayName ?? participant.username)
            : message.userId;
          const role = participant?.role ?? 'observer';

          const parts: string[] = [];
          const text = message.text.trim();
          if (text.length > 0) {
            parts.push(text);
          }
          if (message.attachments.length > 0) {
            parts.push(
              `[attachments: ${message.attachments.map((attachment) => attachment.fileName).join(', ')}]`,
            );
          }

          return {
            role: 'user',
            content: `${identity} (${role}): ${parts.join('\n')}`,
            createdAt: new Date(message.createdAt).toISOString(),
          };
        });
    } catch (error) {
      this.logger.warn(
        `Unable to load room chat history for session reports in room ${roomId}`,
        error,
      );
      return [];
    }
  }

  private async enqueueWeaknessAnalysis(
    sessionId: string,
    userId: string,
    request: Parameters<IAiClient['submitWeaknessAnalysisRequest']>[0] | null,
    reportedAt: Date,
  ): Promise<void> {
    try {
      if (!request) {
        return;
      }

      const { jobId } = await this.aiClient.submitWeaknessAnalysisRequest(request);
      await this.cacheService.set<WeaknessAnalysisJobMeta>(
        `${WEAKNESS_ANALYSIS_META_KEY_PREFIX}${jobId}`,
        { sessionId, userId, reportedAt: reportedAt.toISOString() },
        WEAKNESS_ANALYSIS_META_TTL_SECONDS,
      );
      const cachedResult = await this.aiClient.getWeaknessAnalysisResult(jobId);
      if (cachedResult) {
        await this.handleWeaknessAnalysisResult(jobId, cachedResult);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to enqueue weakness analysis for session ${sessionId} and user ${userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async buildWeaknessAnalysisRequest(
    sessionId: string,
    userId: string,
    report: SessionReport,
    reportGeneratedAt: Date,
  ): Promise<Parameters<IAiClient['submitWeaknessAnalysisRequest']>[0] | null> {
    const sessionRow = await this.db.query.sessions.findFirst({
      columns: {
        id: true,
        roomId: true,
        problemId: true,
        mode: true,
        language: true,
        durationMs: true,
        startedAt: true,
        finishedAt: true,
      },
      where: (table, { eq }) => eq(table.id, sessionId),
    });

    if (!sessionRow) {
      this.logger.warn(`Skipping weakness analysis for missing session ${sessionId}`);
      return null;
    }

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

    const participant = participants.find((item) => item.userId === userId);
    if (!participant) {
      this.logger.warn(
        `Skipping weakness analysis for session ${sessionId}: user ${userId} is not a participant`,
      );
      return null;
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

    const reportRequest = await this.requestBuilder.buildReportRequest(
      sessionRow,
      participants,
      participant,
      problemRow ?? null,
    );
    const historicalWeaknesses = await this.loadHistoricalWeaknesses(userId);

    return {
      sessionId: reportRequest.sessionId,
      roomId: reportRequest.roomId,
      participantId: reportRequest.participantId,
      participantRole: reportRequest.participantRole,
      sessionReportGeneratedAt: reportGeneratedAt.toISOString(),
      problem: {
        id: reportRequest.problem.id,
        title: reportRequest.problem.title,
        description: reportRequest.problem.description,
        difficulty: reportRequest.problem.difficulty,
      },
      language: reportRequest.language,
      durationMs: reportRequest.durationMs,
      snapshots: reportRequest.snapshots,
      runs: reportRequest.runs,
      submissions: reportRequest.submissions,
      peerFeedback: reportRequest.peerFeedback,
      aiMessages: reportRequest.aiMessages,
      staticAnalysis: reportRequest.staticAnalysis,
      sessionReportSummary: {
        overallScore: report.overallScore ?? null,
        feedback: report.detailedFeedback ?? null,
      },
      historicalWeaknesses,
    };
  }

  private async loadHistoricalWeaknesses(
    userId: string,
  ): Promise<Parameters<IAiClient['submitWeaknessAnalysisRequest']>[0]['historicalWeaknesses']> {
    const rows = await this.db
      .select({
        category: userWeaknesses.category,
        description: userWeaknesses.description,
        frequency: userWeaknesses.frequency,
        trend: userWeaknesses.trend,
        lastSeenAt: userWeaknesses.lastSeenAt,
      })
      .from(userWeaknesses)
      .where(eq(userWeaknesses.userId, userId))
      .orderBy(desc(userWeaknesses.lastSeenAt), desc(userWeaknesses.frequency))
      .limit(10);

    return rows.map((row) => ({
      category: row.category,
      description: row.description,
      frequency: row.frequency,
      trend: row.trend,
      lastSeenAt: row.lastSeenAt.toISOString(),
    }));
  }

  private async persistWeaknessSignals(
    sessionId: string,
    userId: string,
    report: SessionReport,
    generatedAt: Date,
  ): Promise<void> {
    const signals = this.extractWeaknessSignals(report);

    const records = await Promise.all(
      signals.map(async (signal) => ({
        category: signal.category,
        description: signal.description,
        sessionDescription: signal.description,
        score: signal.score,
        trend: await this.calculateWeaknessTrend(userId, sessionId, signal.dimension, signal.score),
      })),
    );

    await this.persistWeaknessRecords(sessionId, userId, records, generatedAt);
  }

  private async persistWeaknessAnalysisResult(
    sessionId: string,
    userId: string,
    result: GenerateWeaknessAnalysisResult,
    generatedAt: Date,
  ): Promise<void> {
    const records = result.weaknesses.map((weakness) => ({
      category: weakness.category,
      description: weakness.description,
      sessionDescription: weakness.evidence,
      trend: weakness.trend,
      score: null,
    }));

    await this.persistWeaknessRecords(sessionId, userId, records, generatedAt);
  }

  private async persistWeaknessRecords(
    sessionId: string,
    userId: string,
    records: WeaknessPersistenceRecord[],
    generatedAt: Date,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const existingLinks = await tx
        .select({ weaknessId: weaknessSessions.weaknessId })
        .from(weaknessSessions)
        .innerJoin(userWeaknesses, eq(userWeaknesses.id, weaknessSessions.weaknessId))
        .where(and(eq(userWeaknesses.userId, userId), eq(weaknessSessions.sessionId, sessionId)));
      const touchedWeaknessIds = new Set(existingLinks.map((link) => link.weaknessId));

      if (existingLinks.length > 0) {
        await tx.delete(weaknessSessions).where(
          and(
            eq(weaknessSessions.sessionId, sessionId),
            inArray(
              weaknessSessions.weaknessId,
              existingLinks.map((link) => link.weaknessId),
            ),
          ),
        );
      }

      for (const record of records) {
        const [weakness] = await tx
          .insert(userWeaknesses)
          .values({
            userId,
            category: record.category,
            description: record.description,
            frequency: 1,
            trend: record.trend,
            lastSeenAt: generatedAt,
          })
          .onConflictDoUpdate({
            target: [userWeaknesses.userId, userWeaknesses.category],
            set: {
              description: record.description,
              trend: record.trend,
              lastSeenAt: generatedAt,
            },
          })
          .returning({ id: userWeaknesses.id });

        if (!weakness) {
          continue;
        }

        touchedWeaknessIds.add(weakness.id);

        await tx
          .insert(weaknessSessions)
          .values({
            weaknessId: weakness.id,
            sessionId,
            description: record.sessionDescription ?? record.description,
            trend: record.trend,
            score: record.score,
            reportedAt: generatedAt,
          })
          .onConflictDoNothing();
      }

      for (const weaknessId of touchedWeaknessIds) {
        await tx
          .update(userWeaknesses)
          .set({
            frequency: sql<number>`(
              SELECT COUNT(*)::int
              FROM ${weaknessSessions}
              WHERE ${weaknessSessions.weaknessId} = ${weaknessId}
            )`,
          })
          .where(eq(userWeaknesses.id, weaknessId));
      }

      if (touchedWeaknessIds.size > 0) {
        await tx.delete(userWeaknesses).where(
          and(
            eq(userWeaknesses.userId, userId),
            inArray(userWeaknesses.id, [...touchedWeaknessIds]),
            sql`NOT EXISTS (
                SELECT 1
                FROM ${weaknessSessions}
                WHERE ${weaknessSessions.weaknessId} = ${userWeaknesses.id}
              )`,
          ),
        );
      }
    });
  }

  private extractWeaknessSignals(report: SessionReport): WeaknessSignal[] {
    const signals = new Map<WeaknessCategory, WeaknessSignal>();
    const dimensions = report.dimensions ?? {};
    const areaText = report.areasForImprovement ?? [];

    this.addDimensionSignal(signals, 'correctness', dimensions.correctness, areaText);
    this.addDimensionSignal(signals, 'efficiency', dimensions.efficiency, areaText);
    this.addDimensionSignal(signals, 'codeQuality', dimensions.codeQuality, areaText);
    this.addDimensionSignal(signals, 'communication', dimensions.communication, areaText);
    this.addDimensionSignal(signals, 'problemSolving', dimensions.problemSolving, areaText);

    for (const text of areaText) {
      const category = this.classifyWeaknessText(text);
      if (!category || signals.has(category)) {
        continue;
      }

      const dimension = this.dimensionForCategory(category);
      const score = dimensions[dimension]?.score ?? WEAKNESS_SCORE_THRESHOLD - 1;
      signals.set(category, {
        category,
        dimension,
        score,
        description: this.cleanDescription(text),
      });
    }

    this.addStaticAnalysisSignals(signals, report);

    return [...signals.values()];
  }

  private addStaticAnalysisSignals(
    signals: Map<WeaknessCategory, WeaknessSignal>,
    report: SessionReport,
  ): void {
    for (const analysis of report.staticAnalysis ?? []) {
      if (
        (analysis.summary.highComplexityCount > 0 || analysis.summary.duplicationCount > 0) &&
        !signals.has('code_structure')
      ) {
        signals.set('code_structure', {
          category: 'code_structure',
          dimension: 'codeQuality',
          score: WEAKNESS_SCORE_THRESHOLD - 1,
          description: this.cleanDescription(
            `Static analysis found ${analysis.summary.highComplexityCount} high-complexity functions and ${analysis.summary.duplicationCount} duplicated blocks.`,
          ),
        });
      }

      if (
        !signals.has('variable_naming') &&
        this.hasStaticDiagnosticMatch(analysis.diagnostics, /\bnaming\b|\bidentifier\b/)
      ) {
        signals.set('variable_naming', {
          category: 'variable_naming',
          dimension: 'codeQuality',
          score: WEAKNESS_SCORE_THRESHOLD - 1,
          description: 'Static analysis found naming or identifier diagnostics.',
        });
      }

      if (
        !signals.has('input_validation') &&
        this.hasStaticDiagnosticMatch(analysis.diagnostics, /\binput\b|\bparse|parsing\b/)
      ) {
        signals.set('input_validation', {
          category: 'input_validation',
          dimension: 'correctness',
          score: WEAKNESS_SCORE_THRESHOLD - 1,
          description: 'Static analysis found input or parsing diagnostics.',
        });
      }
    }
  }

  private hasStaticDiagnosticMatch(diagnostics: unknown[], pattern: RegExp): boolean {
    return diagnostics.some((item) => {
      if (!item || typeof item !== 'object') return false;
      const diagnostic = item as Record<string, unknown>;
      return pattern.test(
        [diagnostic.rule, diagnostic.message].filter((part) => typeof part === 'string').join(' '),
      );
    });
  }

  private addDimensionSignal(
    signals: Map<WeaknessCategory, WeaknessSignal>,
    dimension: ReportDimensionKey,
    dimensionResult: SessionReportDimension | undefined,
    areaText: string[],
  ): void {
    if (!dimensionResult || dimensionResult.score >= WEAKNESS_SCORE_THRESHOLD) {
      return;
    }

    const category = this.classifyDimensionWeakness(dimension, [
      dimensionResult.feedback,
      ...areaText,
    ]);

    if (signals.has(category)) {
      return;
    }

    signals.set(category, {
      category,
      dimension,
      score: dimensionResult.score,
      description: this.cleanDescription(dimensionResult.feedback),
    });
  }

  private async calculateWeaknessTrend(
    userId: string,
    sessionId: string,
    dimension: ReportDimensionKey,
    currentScore: number,
  ): Promise<WeaknessTrend> {
    const priorReports = await this.db
      .select({ report: sessionReports.report })
      .from(sessionReports)
      .innerJoin(sessions, eq(sessions.id, sessionReports.sessionId))
      .innerJoin(
        sessionParticipants,
        and(
          eq(sessionParticipants.sessionId, sessionReports.sessionId),
          eq(sessionParticipants.userId, userId),
        ),
      )
      .leftJoin(
        sessionDeletions,
        and(
          eq(sessionDeletions.sessionId, sessionReports.sessionId),
          eq(sessionDeletions.userId, userId),
        ),
      )
      .where(
        and(
          eq(sessionReports.userId, userId),
          eq(sessionReports.status, 'completed'),
          ne(sessionReports.sessionId, sessionId),
          eq(sessions.status, 'finished'),
          sql`${sessionDeletions.userId} IS NULL`,
        ),
      )
      .orderBy(desc(sessionReports.generatedAt), desc(sessionReports.requestedAt))
      .limit(RECENT_REPORT_LIMIT);

    const priorScores = priorReports
      .map((row) => (row.report as SessionReport | null)?.dimensions?.[dimension]?.score)
      .filter((score): score is number => typeof score === 'number');

    if (priorScores.length === 0) {
      return 'stable';
    }

    const priorAverage = priorScores.reduce((sum, score) => sum + score, 0) / priorScores.length;

    if (currentScore >= priorAverage + PRIOR_TREND_DELTA) {
      return 'improving';
    }

    if (currentScore <= priorAverage - PRIOR_TREND_DELTA) {
      return 'worsening';
    }

    return 'stable';
  }

  private classifyDimensionWeakness(
    dimension: ReportDimensionKey,
    texts: readonly string[],
  ): WeaknessCategory {
    const [primaryText, ...supportingTexts] = texts;
    const textCategory =
      this.classifyWeaknessText(primaryText ?? '') ??
      this.classifyWeaknessText(supportingTexts.join(' '));

    if (textCategory && this.isCategoryCompatibleWithDimension(dimension, textCategory)) {
      return textCategory;
    }

    if (dimension === 'correctness') return 'edge_cases';
    if (dimension === 'efficiency') return 'time_complexity';
    if (dimension === 'codeQuality') return 'code_structure';
    if (dimension === 'communication') return 'communication';
    return 'edge_cases';
  }

  private classifyWeaknessText(text: string): WeaknessCategory | null {
    const normalizedText = text.toLowerCase();

    if (/\boff[-\s]?by[-\s]?one\b|\bindex\b|\bboundary\b/.test(normalizedText)) {
      return 'off_by_one';
    }

    if (
      /\binput validation\b|\bvalidate\b|\binvalid input\b|\bempty input\b/.test(normalizedText)
    ) {
      return 'input_validation';
    }

    if (/\bspace\b|\bmemory\b/.test(normalizedText)) {
      return 'space_complexity';
    }

    if (
      /\btime complexity\b|\bruntime\b|\bquadratic\b|\bo\(n\^2\)\b|\boptimi[sz]/.test(
        normalizedText,
      )
    ) {
      return 'time_complexity';
    }

    if (/\bvariable\b|\bnaming\b|\bidentifier\b/.test(normalizedText)) {
      return 'variable_naming';
    }

    if (
      /\bstructure\b|\bdead code\b|\bduplication\b|\breadability\b|\bmodular\b/.test(normalizedText)
    ) {
      return 'code_structure';
    }

    if (/\bcommunicat|\bexplain|\btrade[-\s]?off|\breasoning\b/.test(normalizedText)) {
      return 'communication';
    }

    if (
      /\bedge cases?\b|\bcorner cases?\b|\bhidden cases?\b|\bfailing tests?\b/.test(normalizedText)
    ) {
      return 'edge_cases';
    }

    return null;
  }

  private isCategoryCompatibleWithDimension(
    dimension: ReportDimensionKey,
    category: WeaknessCategory,
  ): boolean {
    if (dimension === 'efficiency') {
      return category === 'time_complexity' || category === 'space_complexity';
    }

    if (dimension === 'codeQuality') {
      return category === 'variable_naming' || category === 'code_structure';
    }

    if (dimension === 'communication') {
      return category === 'communication';
    }

    if (dimension === 'correctness' || dimension === 'problemSolving') {
      return ['edge_cases', 'off_by_one', 'input_validation'].includes(category);
    }

    return false;
  }

  private dimensionForCategory(category: WeaknessCategory): ReportDimensionKey {
    if (category === 'time_complexity' || category === 'space_complexity') {
      return 'efficiency';
    }

    if (category === 'variable_naming' || category === 'code_structure') {
      return 'codeQuality';
    }

    if (category === 'communication') {
      return 'communication';
    }

    return 'correctness';
  }

  private cleanDescription(text: string): string {
    const strippedText = text
      .replace(/<\/?(?:green|yellow|orange|red)>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return strippedText;
  }
}
