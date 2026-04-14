import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  RunCodeRequest,
  RunCodeResponse,
  SubmitProblemInput,
  SubmitResponse,
} from '@syncode/contracts';
import { ERROR_CODES, EXECUTION_CLIENT, type IExecutionClient } from '@syncode/contracts';
import type { Database } from '@syncode/db';
import { executionResults, problems, submissions, testCases } from '@syncode/db';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import type { ExecutionDetailsResult } from './execution.types.js';

@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name);

  constructor(
    @Inject(DB_CLIENT) private readonly db: Database,
    @Inject(EXECUTION_CLIENT) private readonly executionClient: IExecutionClient,
  ) {}

  async runCode(input: RunCodeRequest): Promise<RunCodeResponse> {
    const { jobId } = await this.executionClient.submit(input);
    return { jobId };
  }

  async submitProblem(
    userId: string,
    input: SubmitProblemInput & { problemId: string; roomId: string },
  ): Promise<SubmitResponse> {
    const [problemRow, cases] = await Promise.all([
      this.db
        .select({ id: problems.id })
        .from(problems)
        .where(and(eq(problems.id, input.problemId), isNull(problems.deletedAt)))
        .limit(1)
        .then(([row]) => row),
      this.db
        .select({
          input: testCases.input,
          expectedOutput: testCases.expectedOutput,
          description: testCases.description,
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
      throw new NotFoundException({
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

    const results = await Promise.allSettled(
      cases.map((tc, i) => {
        const request: RunCodeRequest = {
          code: input.code,
          language: input.language,
          stdin: tc.input,
          ...(tc.timeoutMs != null && { timeoutMs: tc.timeoutMs }),
          ...(tc.memoryMb != null && { memoryMb: tc.memoryMb }),
        };

        return this.executionClient.submit(request).then(({ jobId }) => {
          this.logger.debug(`Test case ${i} submitted: ${jobId}`);
        });
      }),
    );

    const failedCount = results.filter((r) => r.status === 'rejected').length;
    if (failedCount > 0) {
      this.logger.error(`${failedCount}/${cases.length} test case jobs failed to enqueue`);
    }

    if (failedCount === cases.length) {
      await this.db
        .update(submissions)
        .set({ status: 'failed', completedAt: new Date() })
        .where(eq(submissions.id, submission.id));
    }

    return { submissionId: submission.id };
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
