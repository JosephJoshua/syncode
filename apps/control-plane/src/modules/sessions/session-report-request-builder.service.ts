import { Inject, Injectable } from '@nestjs/common';
import type {
  GenerateSessionReportRequest,
  SessionReportEventContext,
  StaticAnalysisEvidenceContext,
} from '@syncode/contracts';
import type { Database } from '@syncode/db';
import {
  aiMessages,
  codeSnapshots,
  executionResults,
  peerFeedback,
  runs,
  sessionReports,
  staticAnalysisResults,
  submissions,
  testCases,
  users,
} from '@syncode/db';
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, ne, or } from 'drizzle-orm';
import { DB_CLIENT } from '@/modules/db/db.module.js';

const TERMINAL_STATUSES = ['completed', 'failed'] as const;

interface SessionReportParticipant {
  userId: string;
  username: string;
  displayName: string | null;
  role: 'interviewer' | 'candidate' | 'observer';
}

interface SessionReportSessionRow {
  id: string;
  roomId: string;
  problemId: string | null;
  mode: 'peer' | 'ai';
  language: GenerateSessionReportRequest['language'];
  durationMs: number | null;
  startedAt: Date;
  finishedAt: Date | null;
}

interface SessionReportProblemRow {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  constraints: string | null;
}

@Injectable()
export class SessionReportRequestBuilderService {
  constructor(@Inject(DB_CLIENT) private readonly db: Database) {}

  async buildReportRequest(
    sessionRow: SessionReportSessionRow,
    participants: SessionReportParticipant[],
    participant: SessionReportParticipant,
    problemRow: SessionReportProblemRow | null,
    roomChatMessages: NonNullable<GenerateSessionReportRequest['roomChatMessages']> = [],
  ): Promise<GenerateSessionReportRequest> {
    const sessionWindowStart = sessionRow.startedAt;
    const sessionWindowEnd =
      sessionRow.finishedAt ??
      new Date(sessionWindowStart.getTime() + Math.max(sessionRow.durationMs ?? 0, 15 * 60_000));

    const [snapshotRows, runRows, submissionRows, feedbackRows, aiMessageRows, historicalRows] =
      await Promise.all([
        this.db
          .select({
            snapshotId: codeSnapshots.id,
            timestamp: codeSnapshots.createdAt,
            trigger: codeSnapshots.trigger,
            language: codeSnapshots.language,
            code: codeSnapshots.code,
            linesOfCode: codeSnapshots.linesOfCode,
            phase: codeSnapshots.phase,
          })
          .from(codeSnapshots)
          .where(eq(codeSnapshots.sessionId, sessionRow.id))
          .orderBy(asc(codeSnapshots.createdAt), asc(codeSnapshots.id)),
        this.db
          .select({
            runId: runs.id,
            jobId: runs.jobId,
            createdAt: runs.createdAt,
            status: runs.status,
            code: runs.code,
            language: runs.language,
            stdout: runs.stdout,
            stderr: runs.stderr,
            exitCode: runs.exitCode,
            durationMs: runs.durationMs,
            timedOut: runs.timedOut,
            error: runs.error,
          })
          .from(runs)
          .where(
            and(
              eq(runs.roomId, sessionRow.roomId),
              eq(runs.userId, participant.userId),
              inArray(runs.status, TERMINAL_STATUSES),
            ),
          )
          .orderBy(asc(runs.createdAt), asc(runs.id)),
        this.db
          .select({
            submissionId: submissions.id,
            createdAt: submissions.submittedAt,
            status: submissions.status,
            code: submissions.code,
            language: submissions.language,
            passed: submissions.passedTestCases,
            total: submissions.totalTestCases,
            totalDurationMs: submissions.totalDurationMs,
            problemId: submissions.problemId,
          })
          .from(submissions)
          .where(
            and(
              eq(submissions.roomId, sessionRow.roomId),
              eq(submissions.userId, participant.userId),
              inArray(submissions.status, TERMINAL_STATUSES),
            ),
          )
          .orderBy(asc(submissions.submittedAt), asc(submissions.id)),
        this.db
          .select({
            reviewerId: peerFeedback.reviewerId,
            reviewerUsername: users.username,
            overallRating: peerFeedback.overallRating,
            problemSolvingRating: peerFeedback.problemSolvingRating,
            communicationRating: peerFeedback.communicationRating,
            codeQualityRating: peerFeedback.codeQualityRating,
            debuggingRating: peerFeedback.debuggingRating,
            strengths: peerFeedback.strengths,
            improvements: peerFeedback.improvements,
            wouldPairAgain: peerFeedback.wouldPairAgain,
            createdAt: peerFeedback.createdAt,
          })
          .from(peerFeedback)
          .innerJoin(users, eq(users.id, peerFeedback.reviewerId))
          .where(
            and(
              eq(peerFeedback.sessionId, sessionRow.id),
              eq(peerFeedback.candidateId, participant.userId),
            ),
          )
          .orderBy(asc(peerFeedback.createdAt), asc(peerFeedback.id)),
        this.db
          .select({
            role: aiMessages.role,
            content: aiMessages.content,
            createdAt: aiMessages.createdAt,
          })
          .from(aiMessages)
          .where(
            and(
              eq(aiMessages.roomId, sessionRow.roomId),
              eq(aiMessages.userId, participant.userId),
              or(
                eq(aiMessages.sessionId, sessionRow.id),
                and(
                  isNull(aiMessages.sessionId),
                  gte(aiMessages.createdAt, sessionWindowStart),
                  lte(aiMessages.createdAt, sessionWindowEnd),
                ),
              ),
            ),
          )
          .orderBy(asc(aiMessages.createdAt), asc(aiMessages.id)),
        this.db
          .select({ overallScore: sessionReports.overallScore })
          .from(sessionReports)
          .where(
            and(
              eq(sessionReports.userId, participant.userId),
              eq(sessionReports.status, 'completed'),
              isNotNull(sessionReports.overallScore),
              ne(sessionReports.sessionId, sessionRow.id),
            ),
          )
          .orderBy(desc(sessionReports.generatedAt), desc(sessionReports.requestedAt))
          .limit(10),
      ]);

    const latestSubmission = submissionRows.at(-1) ?? null;
    const staticAnalysis = await this.loadStaticAnalysisContext(
      sessionRow,
      participant,
      runRows.map((run) => run.runId),
      submissionRows.map((submission) => submission.submissionId),
    );
    const finalTestCaseBreakdown = latestSubmission
      ? await this.loadFinalTestCaseBreakdown(
          latestSubmission.submissionId,
          latestSubmission.problemId,
        )
      : [];

    const snapshotContexts = snapshotRows.map((snapshot) => ({
      snapshotId: snapshot.snapshotId,
      timestamp: snapshot.timestamp.toISOString(),
      trigger: snapshot.trigger,
      language: snapshot.language,
      code: snapshot.code,
      linesOfCode: snapshot.linesOfCode ?? snapshot.code.split('\n').length,
      phase: snapshot.phase ?? null,
    }));

    const finalCodeSnapshot = this.selectFinalSnapshot(snapshotContexts);
    const sessionEvents = this.buildSessionEvents(snapshotRows, submissionRows);

    const priorScores = historicalRows
      .map((row) => row.overallScore)
      .filter((score): score is number => score != null);

    return {
      sessionId: sessionRow.id,
      roomId: sessionRow.roomId,
      participantId: participant.userId,
      participantRole: participant.role,
      participants: participants.map((item) => ({
        userId: item.userId,
        username: item.username,
        displayName: item.displayName,
        role: item.role,
      })),
      problem: {
        id: problemRow?.id ?? null,
        title: problemRow?.title ?? null,
        description: problemRow?.description ?? null,
        difficulty: problemRow?.difficulty ?? null,
        constraints: problemRow?.constraints ?? null,
      },
      language: sessionRow.language,
      durationMs: sessionRow.durationMs ?? 0,
      startedAt: sessionRow.startedAt.toISOString(),
      finishedAt: sessionRow.finishedAt?.toISOString() ?? null,
      snapshots: snapshotContexts,
      runs: runRows.map((run) => ({
        jobId: run.jobId,
        createdAt: run.createdAt.toISOString(),
        status: run.status as 'completed' | 'failed',
        code: run.code,
        language: run.language,
        stdout: run.stdout,
        stderr: run.stderr,
        exitCode: run.exitCode,
        durationMs: run.durationMs,
        timedOut: run.timedOut,
        error: run.error,
      })),
      submissions: submissionRows.map((submission) => ({
        submissionId: submission.submissionId,
        createdAt: submission.createdAt.toISOString(),
        status: submission.status as 'completed' | 'failed',
        code: submission.code,
        language: submission.language,
        passed: submission.passed,
        total: submission.total,
        totalDurationMs: submission.totalDurationMs,
      })),
      finalCodeSnapshot,
      sessionEvents,
      finalTestCaseBreakdown,
      peerFeedback: feedbackRows.map((feedback) => ({
        reviewerId: feedback.reviewerId,
        reviewerUsername: feedback.reviewerUsername,
        overallRating: feedback.overallRating,
        problemSolvingRating: feedback.problemSolvingRating,
        communicationRating: feedback.communicationRating,
        codeQualityRating: feedback.codeQualityRating,
        debuggingRating: feedback.debuggingRating,
        strengths: feedback.strengths,
        improvements: feedback.improvements,
        wouldPairAgain: feedback.wouldPairAgain,
        createdAt: feedback.createdAt.toISOString(),
      })),
      aiMessages: aiMessageRows.map((message) => ({
        role: message.role,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      })),
      roomChatMessages,
      historicalContext:
        priorScores.length > 0
          ? {
              sessionsCompared: priorScores.length,
              averageScore:
                Math.round(
                  (priorScores.reduce((sum, score) => sum + score, 0) / priorScores.length) * 10,
                ) / 10,
              priorScores,
            }
          : null,
      staticAnalysis,
    };
  }

  private async loadStaticAnalysisContext(
    sessionRow: SessionReportSessionRow,
    participant: SessionReportParticipant,
    runIds: string[],
    submissionIds: string[],
  ): Promise<StaticAnalysisEvidenceContext[]> {
    const sourceConditions = [
      eq(staticAnalysisResults.sessionId, sessionRow.id),
      ...(runIds.length > 0 ? [inArray(staticAnalysisResults.runId, runIds)] : []),
      ...(submissionIds.length > 0
        ? [inArray(staticAnalysisResults.submissionId, submissionIds)]
        : []),
    ];

    const rows = await this.db
      .select({
        source: staticAnalysisResults.source,
        runId: staticAnalysisResults.runId,
        submissionId: staticAnalysisResults.submissionId,
        language: staticAnalysisResults.language,
        createdAt: staticAnalysisResults.createdAt,
        completedAt: staticAnalysisResults.completedAt,
        diagnosticCount: staticAnalysisResults.diagnosticCount,
        errorCount: staticAnalysisResults.errorCount,
        warningCount: staticAnalysisResults.warningCount,
        maxCyclomaticComplexity: staticAnalysisResults.maxCyclomaticComplexity,
        highComplexityCount: staticAnalysisResults.highComplexityCount,
        duplicationCount: staticAnalysisResults.duplicationCount,
        toolFailureCount: staticAnalysisResults.toolFailureCount,
        report: staticAnalysisResults.report,
      })
      .from(staticAnalysisResults)
      .where(
        and(
          eq(staticAnalysisResults.roomId, sessionRow.roomId),
          eq(staticAnalysisResults.userId, participant.userId),
          eq(staticAnalysisResults.status, 'completed'),
          or(...sourceConditions),
        ),
      )
      .orderBy(asc(staticAnalysisResults.createdAt), asc(staticAnalysisResults.id));

    return rows.map((row) => {
      const report = normalizeStaticAnalysisReport(row.report);
      return {
        source: row.source,
        runId: row.runId,
        submissionId: row.submissionId,
        language: row.language,
        createdAt: row.createdAt.toISOString(),
        completedAt: row.completedAt?.toISOString() ?? null,
        summary: {
          diagnosticCount: row.diagnosticCount,
          errorCount: row.errorCount,
          warningCount: row.warningCount,
          maxCyclomaticComplexity: row.maxCyclomaticComplexity,
          highComplexityCount: row.highComplexityCount,
          duplicationCount: row.duplicationCount,
          toolFailureCount: row.toolFailureCount,
        },
        diagnostics: report.diagnostics.slice(
          0,
          10,
        ) as StaticAnalysisEvidenceContext['diagnostics'],
        complexity: report.complexity.slice(0, 10) as StaticAnalysisEvidenceContext['complexity'],
        duplications: report.duplications.slice(
          0,
          5,
        ) as StaticAnalysisEvidenceContext['duplications'],
      };
    });
  }

  private selectFinalSnapshot(
    snapshots: GenerateSessionReportRequest['snapshots'],
  ): GenerateSessionReportRequest['finalCodeSnapshot'] {
    for (let i = snapshots.length - 1; i >= 0; i -= 1) {
      if (snapshots[i]?.trigger === 'session_end') {
        return snapshots[i] ?? null;
      }
    }

    throw new Error('Cannot build session report without a session_end code snapshot');
  }

  private buildSessionEvents(
    snapshots: Array<{
      timestamp: Date;
      trigger: string;
      phase: string | null;
    }>,
    submissions: Array<{
      submissionId: string;
      createdAt: Date;
      status: string;
      passed: number;
      total: number;
    }>,
  ): SessionReportEventContext[] {
    const events: SessionReportEventContext[] = [];
    let lastPhase: string | null = null;

    for (const snapshot of snapshots) {
      if (snapshot.trigger !== 'phase_change') {
        continue;
      }

      const toStage = snapshot.phase ?? null;
      const fromStage = lastPhase;
      if (toStage) {
        lastPhase = toStage;
      }

      const toStageLabel = toStage ?? 'unknown';
      events.push({
        eventType: 'stage_transition',
        timestamp: snapshot.timestamp.toISOString(),
        details: fromStage ? `${fromStage} -> ${toStageLabel}` : `Entered ${toStageLabel}`,
        metadata: {
          fromStage,
          toStage,
          trigger: snapshot.trigger,
        },
      });
    }

    for (const submission of submissions) {
      events.push({
        eventType: 'submission',
        timestamp: submission.createdAt.toISOString(),
        details: `${submission.status} submission (${submission.passed}/${submission.total})`,
        metadata: {
          submissionId: submission.submissionId,
          status: submission.status,
          passed: submission.passed,
          total: submission.total,
        },
      });
    }

    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return events;
  }

  private async loadFinalTestCaseBreakdown(submissionId: string, problemId: string) {
    const rows = await this.db
      .select({
        testCaseIndex: executionResults.testCaseIndex,
        input: testCases.input,
        description: testCases.description,
        isHidden: testCases.isHidden,
        passed: executionResults.passed,
        expectedOutput: executionResults.expected,
        actualOutput: executionResults.actual,
        stdout: executionResults.stdout,
        stderr: executionResults.stderr,
        exitCode: executionResults.exitCode,
        durationMs: executionResults.durationMs,
        memoryUsageMb: executionResults.memoryUsageMb,
        timedOut: executionResults.timedOut,
        errorMessage: executionResults.errorMessage,
      })
      .from(executionResults)
      .leftJoin(
        testCases,
        and(
          eq(testCases.problemId, problemId),
          eq(testCases.sortOrder, executionResults.testCaseIndex),
        ),
      )
      .where(eq(executionResults.submissionId, submissionId))
      .orderBy(asc(executionResults.testCaseIndex));

    return rows.map((row) => {
      const shouldRedact = row.isHidden !== false;

      return {
        testCaseIndex: row.testCaseIndex,
        input: null,
        description: shouldRedact ? null : (row.description ?? null),
        isHidden: shouldRedact,
        passed: row.passed,
        expectedOutput: null,
        actualOutput: null,
        stdout: null,
        stderr: shouldRedact ? null : row.stderr,
        exitCode: row.exitCode,
        durationMs: row.durationMs,
        memoryUsageMb: row.memoryUsageMb,
        timedOut: row.timedOut,
        errorMessage: shouldRedact ? this.redactHiddenTestError(row) : row.errorMessage,
      };
    });
  }

  private redactHiddenTestError(row: {
    passed: boolean | null;
    exitCode: number | null;
    timedOut: boolean;
    errorMessage: string | null;
    stderr: string | null;
  }) {
    if (row.timedOut) {
      return 'Time limit exceeded';
    }

    if (row.passed === false || row.exitCode !== 0 || row.errorMessage || row.stderr) {
      return 'Hidden test failed';
    }

    return null;
  }
}

function normalizeStaticAnalysisReport(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { diagnostics: [], complexity: [], duplications: [] };
  }

  const report = value as Record<string, unknown>;
  return {
    diagnostics: Array.isArray(report.diagnostics) ? report.diagnostics : [],
    complexity: Array.isArray(report.complexity) ? report.complexity : [],
    duplications: Array.isArray(report.duplications) ? report.duplications : [],
  };
}
