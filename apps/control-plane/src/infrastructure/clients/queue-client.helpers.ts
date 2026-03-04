import type { Logger } from '@nestjs/common';
import type { JobStatus } from '@syncode/contracts';
import type { ICacheService, IQueueService } from '@syncode/shared/ports';

export const RESULT_TTL_SECONDS = 24 * 60 * 60;

/**
 * Shared helpers for queue-based plane clients (execution, AI).
 *
 * Both `QueueExecutionClient` and `QueueAiClient` follow the same
 * enqueue → result-queue → cache pattern. This class extracts the
 * duplicated result-caching and job-status logic.
 */
export class QueueClientHelper {
  constructor(
    private readonly queueService: IQueueService,
    private readonly cacheService: ICacheService,
    private readonly logger: Logger,
    private readonly cacheKeyPrefix: string,
  ) {}

  /**
   * Register a processor that caches results arriving on a return queue.
   */
  processResultQueue<T>(queue: string, label: string): void {
    this.queueService.process<T & { jobId: string }>(
      queue,
      async (job) => {
        if (!job.data.jobId) {
          this.logger.warn(`Received ${label} result without jobId, skipping`);
          return;
        }
        await this.cacheService.set(
          `${this.cacheKeyPrefix}${job.data.jobId}`,
          job.data,
          RESULT_TTL_SECONDS,
        );
        this.logger.debug(`Cached ${label} result for job ${job.data.jobId}`);
      },
      { concurrency: 10 },
    );
  }

  /**
   * Look up a cached result by job ID.
   */
  async getResult<T>(jobId: string): Promise<T | null> {
    return this.cacheService.get<T>(`${this.cacheKeyPrefix}${jobId}`);
  }

  /**
   * Derive job status from cache + queue state.
   */
  async getJobStatus(queueName: string, jobId: string): Promise<JobStatus> {
    const cached = await this.cacheService.exists(`${this.cacheKeyPrefix}${jobId}`);
    if (cached) return 'completed';

    const job = await this.queueService.getJob(queueName, jobId);
    if (!job) return 'failed';

    if (job.finishedOn) {
      return job.failedReason ? 'failed' : 'completed';
    }
    if (job.processedOn) return 'running';
    return 'queued';
  }
}
