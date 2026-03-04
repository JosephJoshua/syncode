import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  EXECUTION_QUEUE,
  EXECUTION_RESULT_QUEUE,
  type RunCodeRequest,
  type RunCodeResult,
} from '@syncode/contracts';
import { type ExecutionRequest, SUPPORTED_LANGUAGES } from '@syncode/shared';
import type { IQueueService, ISandboxProvider, QueueJob } from '@syncode/shared/ports';
import { QUEUE_SERVICE, SANDBOX_PROVIDER } from '@syncode/shared/ports';

const MAX_TIMEOUT_MS = 5 * 60 * 1_000;
const DEFAULT_TIMEOUT_MS = 30 * 1_000;

const MAX_MEMORY_MB = 1024;
const DEFAULT_MEMORY_MB = 128;

const LOCK_DURATION_MS = MAX_TIMEOUT_MS + 30_000;

@Injectable()
export class ExecutionProcessor implements OnModuleInit {
  private readonly logger = new Logger(ExecutionProcessor.name);

  constructor(
    @Inject(QUEUE_SERVICE) private readonly queueService: IQueueService,
    @Inject(SANDBOX_PROVIDER) private readonly sandbox: ISandboxProvider,
  ) {}

  onModuleInit() {
    this.queueService.process<RunCodeRequest>(
      EXECUTION_QUEUE,
      async (job: QueueJob<RunCodeRequest>) => {
        await this.handleJob(job);
      },
      { concurrency: 5, lockDuration: LOCK_DURATION_MS },
    );
    this.logger.log(`Registered processor on ${EXECUTION_QUEUE}`);
  }

  private async handleJob(job: QueueJob<RunCodeRequest>): Promise<void> {
    const { id: jobId, data: request } = job;
    this.logger.log(`Processing execution job ${jobId} (language=${request.language})`);

    // Permanent failures that won't fix on retry.
    const validationError = this.validateRequest(request);
    if (validationError) {
      this.logger.warn(`Execution job ${jobId} rejected: ${validationError}`);
      await this.queueService.enqueue(EXECUTION_RESULT_QUEUE, 'execution-result', {
        status: 'failed',
        stdout: '',
        stderr: '',
        exitCode: -1,
        durationMs: 0,
        timedOut: false,
        error: validationError,
        jobId,
      });
      return;
    }

    const timeoutMs = Math.min(request.timeoutMs ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);
    const memoryMb = Math.min(request.memoryMb ?? DEFAULT_MEMORY_MB, MAX_MEMORY_MB);

    const execRequest: ExecutionRequest = {
      requestId: jobId,
      userId: 'system',
      language: request.language,
      code: request.code,
      stdin: request.stdin,
      timeoutMs,
      memoryMb,
    };

    // Transient errors propagate so BullMQ retries.
    const execResult = await this.sandbox.execute(execRequest);

    const result: RunCodeResult = {
      status: execResult.status,
      stdout: execResult.stdout,
      stderr: execResult.stderr,
      exitCode: execResult.exitCode,
      durationMs: execResult.durationMs,
      timedOut: execResult.timedOut,
      error: execResult.error,
      cpuTimeMs: execResult.cpuTimeMs,
      memoryUsageMb: execResult.memoryUsageMb,
      outputTruncated: execResult.outputTruncated,
    };

    await this.queueService.enqueue(EXECUTION_RESULT_QUEUE, 'execution-result', {
      ...result,
      jobId,
    });

    this.logger.log(`Execution job ${jobId} completed with status=${result.status}`);
  }

  private validateRequest(request: RunCodeRequest): string | null {
    if (!SUPPORTED_LANGUAGES.includes(request.language)) {
      return `Unsupported language: ${request.language}`;
    }
    if (!this.sandbox.supportsLanguage(request.language)) {
      return `Sandbox does not support language: ${request.language}`;
    }
    if (!request.code || request.code.trim().length === 0) {
      return 'Code cannot be empty';
    }
    return null;
  }
}
