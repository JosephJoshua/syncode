import { randomUUID } from 'node:crypto';
import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  ERROR_CODES,
  EXECUTION_CLIENT,
  type IExecutionClient,
  type JobId,
  type RunCodeRequest,
  type RunCodeResponse,
  type StaticAnalysisReport,
  type StaticAnalysisRequest,
  type StaticAnalysisResultResponse,
  type SubmitProblemInput,
  type SubmitResponse,
} from '@syncode/contracts';
import type { Database } from '@syncode/db';
import {
  executionResults,
  problems,
  runs,
  staticAnalysisResults,
  submissions,
  testCases,
} from '@syncode/db';
import { CACHE_SERVICE, type ICacheService } from '@syncode/shared/ports';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import {
  EXEC_META_KEY_PREFIX,
  EXEC_META_TTL_SECONDS,
  type ExecutionDetailsResult,
  type JobMeta,
  type RunCodeContext,
  type SubmitProblemContext,
} from './execution.types.js';

@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name);

  constructor(
    @Inject(DB_CLIENT) private readonly db: Database,
    @Inject(EXECUTION_CLIENT) private readonly executionClient: IExecutionClient,
    @Inject(CACHE_SERVICE) private readonly cacheService: ICacheService,
  ) {}

  async runCode(input: RunCodeRequest, context?: RunCodeContext): Promise<RunCodeResponse> {
    const { jobId } = await this.executionClient.submit(input);
    let staticAnalysisJobId: string | null = null;

    if (context) {
      const [run] = await this.db
        .insert(runs)
        .values({
          userId: context.userId,
          roomId: context.roomId,
          jobId,
          code: input.code,
          language: input.language,
          stdin: input.stdin ?? null,
          status: 'pending',
        })
        .returning({ id: runs.id });

      if (!run) {
        throw new InternalServerErrorException('Run insert returned no rows');
      }

      await this.cacheService.set(
        `${EXEC_META_KEY_PREFIX}${jobId}`,
        { kind: 'run', runId: run.id } satisfies JobMeta,
        EXEC_META_TTL_SECONDS,
      );

      staticAnalysisJobId = await this.enqueueStaticAnalysis({
        userId: context.userId,
        roomId: context.roomId,
        sessionId: context.sessionId ?? null,
        runId: run.id,
        submissionId: null,
        language: input.language,
        source: 'run',
        code: input.code,
      });
    }

    return { jobId, staticAnalysisJobId };
  }

  async submitProblem(
    userId: string,
    input: SubmitProblemInput & { problemId: string; roomId: string },
    context: SubmitProblemContext = {},
  ): Promise<SubmitResponse> {
    const [problemRow, cases] = await Promise.all([
      this.db
        .select({
          id: problems.id,
          timeLimit: problems.timeLimit,
          memoryLimit: problems.memoryLimit,
        })
        .from(problems)
        .where(
          and(
            eq(problems.id, input.problemId),
            isNull(problems.deletedAt),
            eq(problems.isPublished, true),
          ),
        )
        .limit(1)
        .then(([row]) => row),
      this.db
        .select({
          input: testCases.input,
          expectedOutput: testCases.expectedOutput,
          timeoutMs: testCases.timeoutMs,
          memoryMb: testCases.memoryMb,
        })
        .from(testCases)
        .where(eq(testCases.problemId, input.problemId))
        .orderBy(asc(testCases.sortOrder)),
    ]);

    if (!problemRow) {
      throw new NotFoundException({
        message: 'Problem not found',
        code: ERROR_CODES.PROBLEM_NOT_FOUND,
      });
    }

    if (cases.length === 0) {
      throw new UnprocessableEntityException({
        message: 'Problem has no test cases',
        code: ERROR_CODES.PROBLEM_NO_TEST_CASES,
      });
    }

    const [submission] = await this.db
      .insert(submissions)
      .values({
        userId,
        roomId: input.roomId,
        problemId: input.problemId,
        code: input.code,
        language: input.language,
        status: 'pending',
        totalTestCases: cases.length,
      })
      .returning({ id: submissions.id });

    if (!submission) {
      throw new InternalServerErrorException('Submission insert returned no rows');
    }

    const staticAnalysisJobId = await this.enqueueStaticAnalysis({
      userId,
      roomId: input.roomId,
      sessionId: context.sessionId ?? null,
      runId: null,
      submissionId: submission.id,
      language: input.language,
      source: 'submission',
      code: input.code,
    });

    const results = await Promise.allSettled(
      cases.map((tc, i) => {
        const timeoutMs = tc.timeoutMs ?? problemRow.timeLimit;
        const memoryMb = tc.memoryMb ?? problemRow.memoryLimit;
        const request: RunCodeRequest = {
          code: input.code,
          language: input.language,
          stdin: tc.input,
          ...(timeoutMs != null && { timeoutMs }),
          ...(memoryMb != null && { memoryMb }),
        };

        return this.executionClient.submit(request).then(async ({ jobId }) => {
          const meta: JobMeta = {
            kind: 'submission',
            submissionId: submission.id,
            testCaseIndex: i,
            expectedOutput: tc.expectedOutput,
          };
          await this.cacheService.set(
            `${EXEC_META_KEY_PREFIX}${jobId}`,
            meta,
            EXEC_META_TTL_SECONDS,
          );
          this.logger.debug(`Test case ${i} submitted: ${jobId}`);
        });
      }),
    );

    const failedCount = results.filter((r) => r.status === 'rejected').length;
    if (failedCount > 0) {
      this.logger.error(`${failedCount}/${cases.length} test case jobs failed to enqueue`);

      const enqueuedCount = cases.length - failedCount;
      await this.db
        .update(submissions)
        .set({
          totalTestCases: enqueuedCount,
          ...(enqueuedCount === 0 && { status: 'failed' as const, completedAt: new Date() }),
        })
        .where(eq(submissions.id, submission.id));
    }

    return { submissionId: submission.id, staticAnalysisJobId };
  }

  private async enqueueStaticAnalysis(request: StaticAnalysisRequest): Promise<string | null> {
    const jobId = randomUUID() as JobId<'static-analysis'>;
    await this.db.insert(staticAnalysisResults).values({
      jobId,
      userId: request.userId,
      roomId: request.roomId,
      sessionId: request.sessionId ?? null,
      runId: request.runId ?? null,
      submissionId: request.submissionId ?? null,
      language: request.language,
      source: request.source,
      status: 'pending',
    });

    try {
      const submitted = await this.executionClient.submitStaticAnalysis(request, {
        idempotencyKey: jobId,
      });
      if (submitted.jobId !== jobId) {
        this.logger.warn(
          `Static analysis queue returned unexpected job ID ${submitted.jobId} for preallocated ${jobId}`,
        );
      }
    } catch (error) {
      await this.db.delete(staticAnalysisResults).where(eq(staticAnalysisResults.jobId, jobId));
      this.logger.warn(
        `Static analysis enqueue failed for ${request.source}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }

    return jobId;
  }

  async getStaticAnalysisResult(
    jobId: string,
    userId: string,
  ): Promise<StaticAnalysisResultResponse> {
    const [row] = await this.db
      .select()
      .from(staticAnalysisResults)
      .where(and(eq(staticAnalysisResults.jobId, jobId), eq(staticAnalysisResults.userId, userId)))
      .limit(1);

    if (!row) {
      throw new NotFoundException({
        message: 'Static analysis result not found',
        code: ERROR_CODES.ANALYSIS_JOB_NOT_FOUND,
      });
    }

    const base = {
      jobId: row.jobId,
      source: row.source,
      runId: row.runId,
      submissionId: row.submissionId,
      language: row.language,
      createdAt: row.createdAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
    };

    if (row.status === 'pending') {
      return { ...base, status: 'pending' };
    }

    const report = normalizeStaticAnalysisReport(row.report);
    return {
      ...base,
      status: row.status,
      summary: {
        diagnosticCount: row.diagnosticCount,
        errorCount: row.errorCount,
        warningCount: row.warningCount,
        maxCyclomaticComplexity: row.maxCyclomaticComplexity,
        highComplexityCount: row.highComplexityCount,
        duplicationCount: row.duplicationCount,
        toolFailureCount: row.toolFailureCount,
      },
      diagnostics: report.diagnostics,
      complexity: report.complexity,
      duplications: report.duplications,
      toolResults: report.toolResults,
      error: row.errorMessage,
    };
  }

  async getSubmissionDetails(
    submissionId: string,
    userId: string,
  ): Promise<ExecutionDetailsResult> {
    // Scope the lookup by both submission ID and current user to enforce ownership.
    const [submission] = await this.db
      .select({
        id: submissions.id,
        status: submissions.status,
        totalTestCases: submissions.totalTestCases,
        passedTestCases: submissions.passedTestCases,
        failedTestCases: submissions.failedTestCases,
        errorTestCases: submissions.errorTestCases,
        totalDurationMs: submissions.totalDurationMs,
        submittedAt: submissions.submittedAt,
        completedAt: submissions.completedAt,
      })
      .from(submissions)
      .where(and(eq(submissions.id, submissionId), eq(submissions.userId, userId)))
      .limit(1);

    if (!submission) {
      throw new NotFoundException({
        message: 'Submission not found',
        code: ERROR_CODES.SUBMISSION_NOT_FOUND,
      });
    }

    // Always return per-case results in ascending test case index order.
    const rows = await this.db
      .select({
        testCaseIndex: executionResults.testCaseIndex,
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
      .where(eq(executionResults.submissionId, submissionId))
      .orderBy(asc(executionResults.testCaseIndex));

    return {
      submissionId: submission.id,
      status: submission.status,
      totalTestCases: submission.totalTestCases,
      passedTestCases: submission.passedTestCases,
      failedTestCases: submission.failedTestCases,
      errorTestCases: submission.errorTestCases,
      totalDurationMs: submission.totalDurationMs,
      submittedAt: submission.submittedAt,
      completedAt: submission.completedAt,
      testCases: rows.map((row) => ({
        testCaseIndex: row.testCaseIndex,
        passed: row.passed,
        expectedOutput: row.expectedOutput,
        actualOutput: row.actualOutput,
        stdout: row.stdout,
        stderr: row.stderr,
        exitCode: row.exitCode,
        durationMs: row.durationMs,
        memoryUsageMb: row.memoryUsageMb,
        timedOut: row.timedOut,
        errorMessage: row.errorMessage,
      })),
    };
  }
}

function normalizeStaticAnalysisReport(report: unknown): StaticAnalysisReport {
  if (!report || typeof report !== 'object') {
    return emptyStaticAnalysisReport();
  }

  const candidate = report as Partial<StaticAnalysisReport>;
  return {
    diagnostics: Array.isArray(candidate.diagnostics) ? candidate.diagnostics : [],
    complexity: Array.isArray(candidate.complexity) ? candidate.complexity : [],
    duplications: Array.isArray(candidate.duplications) ? candidate.duplications : [],
    toolResults: Array.isArray(candidate.toolResults) ? candidate.toolResults : [],
  };
}

function emptyStaticAnalysisReport(): StaticAnalysisReport {
  return {
    diagnostics: [],
    complexity: [],
    duplications: [],
    toolResults: [],
  };
}
