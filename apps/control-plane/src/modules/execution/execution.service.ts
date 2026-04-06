import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ERROR_CODES } from '@syncode/contracts';
import type { Database } from '@syncode/db';
import { executionResults, submissions } from '@syncode/db';
import { and, asc, eq } from 'drizzle-orm';
import { DB_CLIENT } from '@/modules/db/db.module';
import type { ExecutionDetailsResult } from './execution.types.js';

@Injectable()
export class ExecutionService {
  constructor(@Inject(DB_CLIENT) private readonly db: Database) {}

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
