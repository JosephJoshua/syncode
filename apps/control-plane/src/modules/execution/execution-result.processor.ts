import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  EXECUTION_CLIENT,
  type IExecutionClient,
  type RunCodeResult,
  type StaticAnalysisResult,
} from '@syncode/contracts';
import type { Database } from '@syncode/db';
import { executionResults, runs, staticAnalysisResults, submissions } from '@syncode/db';
import { CACHE_SERVICE, type ICacheService } from '@syncode/shared/ports';
import { eq, sql } from 'drizzle-orm';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import { EXEC_META_KEY_PREFIX, type JobMeta } from './execution.types.js';

@Injectable()
export class ExecutionResultProcessor implements OnModuleInit {
  private readonly logger = new Logger(ExecutionResultProcessor.name);

  constructor(
    @Inject(DB_CLIENT) private readonly db: Database,
    @Inject(CACHE_SERVICE) private readonly cacheService: ICacheService,
    @Inject(EXECUTION_CLIENT) private readonly executionClient: IExecutionClient,
  ) {}

  onModuleInit() {
    this.executionClient.onResult(this.handleResult.bind(this));
    this.executionClient.onStaticAnalysisResult(this.handleStaticAnalysisResult.bind(this));
  }

  async handleResult(jobId: string, result: RunCodeResult): Promise<void> {
    const meta = await this.cacheService.get<JobMeta>(`${EXEC_META_KEY_PREFIX}${jobId}`);
    if (!meta) {
      this.logger.debug(`No metadata for job ${jobId}, skipping DB persistence`);
      return;
    }

    if (meta.kind === 'run') {
      await this.persistRunResult(jobId, meta.runId, result);
      return;
    }

    const actual = result.stdout?.trimEnd() ?? '';
    const passed = result.status === 'completed' ? actual === meta.expectedOutput.trimEnd() : null;

    await this.db
      .insert(executionResults)
      .values({
        submissionId: meta.submissionId,
        testCaseIndex: meta.testCaseIndex,
        passed,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        expected: meta.expectedOutput,
        actual: result.status === 'completed' ? actual : null,
        durationMs: result.durationMs,
        memoryUsageMb: result.memoryUsageMb,
        timedOut: result.timedOut,
        errorMessage: result.error ?? null,
      })
      .onConflictDoNothing();

    await this.db.execute(sql`
      WITH agg AS (
        SELECT
          count(*)                                          AS total,
          count(*) FILTER (WHERE ${executionResults.passed} = true)  AS passed_count,
          count(*) FILTER (WHERE ${executionResults.passed} = false) AS failed_count,
          count(*) FILTER (WHERE ${executionResults.passed} IS NULL) AS error_count,
          coalesce(sum(${executionResults.durationMs}), 0)  AS total_dur
        FROM ${executionResults}
        WHERE ${executionResults.submissionId} = ${meta.submissionId}
      )
      UPDATE ${submissions} SET
        status = CASE
          WHEN agg.total = ${submissions.totalTestCases}
          THEN 'completed'::submission_status
          ELSE 'running'::submission_status
        END,
        passed_test_cases = agg.passed_count,
        failed_test_cases = agg.failed_count,
        error_test_cases = agg.error_count,
        total_duration_ms = agg.total_dur,
        completed_at = CASE
          WHEN agg.total = ${submissions.totalTestCases} THEN now()
          ELSE ${submissions.completedAt}
        END
      FROM agg
      WHERE ${submissions.id} = ${meta.submissionId}
    `);

    await this.cacheService.del(`${EXEC_META_KEY_PREFIX}${jobId}`);

    this.logger.debug(
      `Persisted result for job ${jobId} (submission ${meta.submissionId}, case ${meta.testCaseIndex})`,
    );
  }

  private async persistRunResult(
    jobId: string,
    runId: string,
    result: RunCodeResult,
  ): Promise<void> {
    await this.db
      .update(runs)
      .set({
        status: result.status,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        durationMs: result.durationMs,
        cpuTimeMs: result.cpuTimeMs,
        memoryUsageMb: result.memoryUsageMb,
        timedOut: result.timedOut,
        outputTruncated: result.outputTruncated ?? false,
        error: result.error ?? null,
        completedAt: new Date(),
      })
      .where(eq(runs.id, runId));

    await this.cacheService.del(`${EXEC_META_KEY_PREFIX}${jobId}`);
    this.logger.debug(`Persisted result for job ${jobId} (run ${runId})`);
  }

  private async handleStaticAnalysisResult(
    jobId: string,
    result: StaticAnalysisResult,
  ): Promise<void> {
    await this.db
      .update(staticAnalysisResults)
      .set({
        status: result.status,
        diagnosticCount: result.summary.diagnosticCount,
        errorCount: result.summary.errorCount,
        warningCount: result.summary.warningCount,
        maxCyclomaticComplexity: result.summary.maxCyclomaticComplexity,
        highComplexityCount: result.summary.highComplexityCount,
        duplicationCount: result.summary.duplicationCount,
        toolFailureCount: result.summary.toolFailureCount,
        report: {
          diagnostics: result.diagnostics,
          complexity: result.complexity,
          duplications: result.duplications,
          toolResults: result.toolResults,
        },
        errorMessage: result.error ?? null,
        completedAt: new Date(),
      })
      .where(eq(staticAnalysisResults.jobId, jobId));

    this.logger.debug(`Persisted static analysis result for job ${jobId}`);
  }
}
