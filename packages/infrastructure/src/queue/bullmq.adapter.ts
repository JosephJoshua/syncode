import type { OnModuleDestroy } from '@nestjs/common';
import { Injectable, Logger } from '@nestjs/common';
import type {
  IQueueService,
  QueueEventHandler,
  QueueJob,
  QueueJobOptions,
  QueueProcessOptions,
  QueueStats,
} from '@syncode/shared';
import type { Job as BullMQJob, JobsOptions } from 'bullmq';
import { Queue, QueueEvents, Worker } from 'bullmq';
import type { RedisConfig } from '../config.js';

@Injectable()
export class BullMqAdapter implements IQueueService, OnModuleDestroy {
  private static readonly DEFAULT_MAX_ATTEMPTS = 3;

  private readonly logger = new Logger(BullMqAdapter.name);
  private readonly queues = new Map<string, Queue>();
  private readonly workers = new Map<string, Worker>();
  private readonly workerOptions = new Map<string, QueueProcessOptions>();
  private readonly queueEvents = new Map<string, QueueEvents>();
  private readonly config: RedisConfig;

  constructor(config: RedisConfig) {
    this.config = config;
  }

  async enqueue<T>(
    queueName: string,
    jobName: string,
    data: T,
    options?: QueueJobOptions,
  ): Promise<string> {
    const queue = this.getOrCreateQueue(queueName);
    const bullOptions = this.mapOptionsToBull(options);

    const job = await queue.add(jobName, data, bullOptions);
    if (!job.id) {
      throw new Error(`Failed to enqueue job ${jobName}: no job ID assigned`);
    }
    return job.id;
  }

  async enqueueBulk<T>(
    queueName: string,
    jobs: Array<{ name: string; data: T; options?: QueueJobOptions }>,
  ): Promise<string[]> {
    const queue = this.getOrCreateQueue(queueName);
    const bullJobs = jobs.map((job) => ({
      name: job.name,
      data: job.data,
      opts: this.mapOptionsToBull(job.options),
    }));

    const addedJobs = await queue.addBulk(bullJobs);

    const jobIds: string[] = [];
    const failures: string[] = [];

    for (const job of addedJobs) {
      if (!job.id) {
        failures.push(job.name ?? 'unknown');
      } else {
        jobIds.push(job.id);
      }
    }

    if (failures.length > 0) {
      throw new Error(
        `Failed to enqueue ${failures.length} bulk job(s) (no job ID assigned): ${failures.join(', ')}`,
      );
    }

    return jobIds;
  }

  process<T>(
    queueName: string,
    handler: (job: QueueJob<T>) => Promise<void>,
    options?: QueueProcessOptions,
  ): void {
    if (this.workers.has(queueName)) {
      this.logger.warn(`Worker for queue ${queueName} already exists`);
      return;
    }

    const worker = new Worker<T>(
      queueName,
      async (bullJob: BullMQJob<T>) => {
        try {
          const queueJob = this.mapBullJobToQueueJob<T>(bullJob);
          await handler(queueJob);
        } catch (error) {
          this.logger.error(`Error processing job ${bullJob.id} in queue ${queueName}:`, error);
          throw error; // Re-throw for BullMQ retry logic.
        }
      },
      {
        connection: { url: this.config.url },
        concurrency: options?.concurrency ?? 1,
        lockDuration: options?.lockDuration ?? 30000,
        stalledInterval: options?.stalledInterval ?? 5000,
      },
    );

    this.workers.set(queueName, worker);
    if (options) {
      this.workerOptions.set(queueName, options);
    }
  }

  async getJob<T>(queueName: string, jobId: string): Promise<QueueJob<T> | null> {
    const queue = this.getOrCreateQueue(queueName);
    const bullJob = await queue.getJob(jobId);

    if (!bullJob) {
      return null;
    }

    return this.mapBullJobToQueueJob<T>(bullJob as BullMQJob<T>);
  }

  async getDeadLetterJobs(queueName: string, start = 0, end = -1): Promise<QueueJob[]> {
    const queue = this.getOrCreateQueue(queueName);
    const failedJobs = await queue.getFailed(start, end);

    return failedJobs
      .filter(
        (job) => job.attemptsMade >= (job.opts.attempts ?? BullMqAdapter.DEFAULT_MAX_ATTEMPTS),
      )
      .map((job) => this.mapBullJobToQueueJob(job));
  }

  async retryDeadLetterJob(queueName: string, jobId: string): Promise<void> {
    const queue = this.getOrCreateQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      throw new Error(`Job ${jobId} not found in queue ${queueName}`);
    }

    if (await job.isFailed()) {
      await job.retry();
    } else {
      throw new Error(`Job ${jobId} is not in failed state`);
    }
  }

  async retryAllDeadLetterJobs(queueName: string): Promise<number> {
    const deadLetterJobs = await this.getDeadLetterJobs(queueName);
    let retried = 0;

    for (const job of deadLetterJobs) {
      try {
        await this.retryDeadLetterJob(queueName, job.id);
        retried++;
      } catch (error) {
        this.logger.error(`Failed to retry job ${job.id}:`, error);
      }
    }

    return retried;
  }

  async purgeDeadLetterQueue(queueName: string): Promise<number> {
    const queue = this.getOrCreateQueue(queueName);
    const failedJobs = await queue.getFailed();
    const deadLetterJobs = failedJobs.filter(
      (job) => job.attemptsMade >= (job.opts.attempts ?? BullMqAdapter.DEFAULT_MAX_ATTEMPTS),
    );

    let removed = 0;
    for (const job of deadLetterJobs) {
      await job.remove();
      removed++;
    }

    return removed;
  }

  async getQueueStats(queueName: string): Promise<QueueStats> {
    const queue = this.getOrCreateQueue(queueName);
    const counts = await queue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
      'paused',
    );

    return {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
      paused: counts.paused ?? 0,
    };
  }

  async drain(queueName: string): Promise<void> {
    const queue = this.getOrCreateQueue(queueName);
    await queue.drain();
  }

  async pause(queueName: string): Promise<void> {
    const queue = this.getOrCreateQueue(queueName);
    await queue.pause();
  }

  async resume(queueName: string): Promise<void> {
    const queue = this.getOrCreateQueue(queueName);
    await queue.resume();
  }

  registerEventHandlers(queueName: string, handlers: QueueEventHandler): void {
    if (this.queueEvents.has(queueName)) {
      this.logger.warn(
        `Event handlers already registered for queue ${queueName}. Skipping to prevent duplicate listeners.`,
      );
      return;
    }

    const events = new QueueEvents(queueName, {
      connection: { url: this.config.url },
    });
    this.queueEvents.set(queueName, events);

    if (handlers.onCompleted) {
      const onCompleted = handlers.onCompleted;
      events.on('completed', async ({ jobId }) => {
        try {
          const queue = this.getOrCreateQueue(queueName);
          const job = await queue.getJob(jobId);
          if (job) {
            onCompleted(this.mapBullJobToQueueJob(job));
          }
        } catch (error) {
          this.logger.error(`Error in onCompleted handler for job ${jobId}:`, error);
        }
      });
    }

    if (handlers.onFailed) {
      const onFailed = handlers.onFailed;
      events.on('failed', async ({ jobId, failedReason }) => {
        try {
          const queue = this.getOrCreateQueue(queueName);
          const job = await queue.getJob(jobId);
          if (job) {
            const queueJob = this.mapBullJobToQueueJob(job);
            onFailed(queueJob, new Error(failedReason));
          }
        } catch (error) {
          this.logger.error(`Error in onFailed handler for job ${jobId}:`, error);
        }
      });
    }

    if (handlers.onDeadLetter) {
      const onDeadLetter = handlers.onDeadLetter;
      events.on('failed', async ({ jobId }) => {
        try {
          const queue = this.getOrCreateQueue(queueName);
          const job = await queue.getJob(jobId);
          if (
            job &&
            job.attemptsMade >= (job.opts.attempts ?? BullMqAdapter.DEFAULT_MAX_ATTEMPTS)
          ) {
            onDeadLetter(this.mapBullJobToQueueJob(job));
          }
        } catch (error) {
          this.logger.error(`Error in onDeadLetter handler for job ${jobId}:`, error);
        }
      });
    }

    if (handlers.onStalled) {
      const onStalled = handlers.onStalled;
      events.on('stalled', async ({ jobId }) => {
        try {
          onStalled(jobId);
        } catch (error) {
          this.logger.error(`Error in onStalled handler for job ${jobId}:`, error);
        }
      });
    }
  }

  async shutdown(): Promise<void> {
    this.logger.log('Shutting down BullMQ adapter...');

    const workerCloses = Array.from(this.workers.entries()).map(async ([queueName, worker]) => {
      // Get timeout from worker options or use default
      const options = this.workerOptions.get(queueName);
      const shutdownTimeout = options?.shutdownTimeoutMs ?? 30000;

      try {
        await Promise.race([
          worker.close(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Worker close timeout')), shutdownTimeout),
          ),
        ]);
        this.logger.log(`Worker for queue ${queueName} closed`);
      } catch (error) {
        this.logger.error(`Error closing worker for ${queueName}, forcing closure:`, error);
        try {
          await worker.close(true); // Force close.
        } catch (forceError) {
          this.logger.error(`Error force-closing worker for ${queueName}:`, forceError);
        }
      }
    });

    await Promise.allSettled(workerCloses);

    const eventCloses = Array.from(this.queueEvents.entries()).map(async ([queueName, events]) => {
      try {
        await events.close();
        this.logger.log(`Queue events for ${queueName} closed`);
      } catch (error) {
        this.logger.error(`Error closing events for ${queueName}:`, error);
      }
    });

    await Promise.allSettled(eventCloses);

    const queueCloses = Array.from(this.queues.entries()).map(async ([queueName, queue]) => {
      try {
        await queue.close();
        this.logger.log(`Queue ${queueName} closed`);
      } catch (error) {
        this.logger.error(`Error closing queue ${queueName}:`, error);
      }
    });

    await Promise.allSettled(queueCloses);

    this.workers.clear();
    this.workerOptions.clear();
    this.queueEvents.clear();
    this.queues.clear();
  }

  async onModuleDestroy(): Promise<void> {
    await this.shutdown();
  }

  private getOrCreateQueue(queueName: string): Queue {
    let queue = this.queues.get(queueName);

    if (!queue) {
      queue = new Queue(queueName, {
        connection: { url: this.config.url },
      });
      this.queues.set(queueName, queue);
    }

    return queue;
  }

  private mapOptionsToBull(options?: QueueJobOptions): JobsOptions {
    const bullOptions: JobsOptions = {};

    if (options?.priority !== undefined) {
      bullOptions.priority = options.priority;
    }
    if (options?.delay !== undefined) {
      bullOptions.delay = options.delay;
    }
    if (options?.attempts !== undefined) {
      bullOptions.attempts = options.attempts;
    }
    if (options?.backoff) {
      bullOptions.backoff = {
        type: options.backoff.type,
        delay: options.backoff.delay,
      };
    }
    if (options?.removeOnComplete !== undefined) {
      bullOptions.removeOnComplete = options.removeOnComplete;
    }
    if (options?.removeOnFail !== undefined) {
      bullOptions.removeOnFail = options.removeOnFail;
    }
    if (options?.idempotencyKey) {
      bullOptions.jobId = options.idempotencyKey;
    }
    if (options?.ttl !== undefined) {
      this.logger.warn(
        'TTL option is not supported by BullMQ adapter. Use removeOnComplete/removeOnFail for job cleanup instead.',
      );
    }

    return bullOptions;
  }

  private mapBullJobToQueueJob<T>(bullJob: BullMQJob<T>): QueueJob<T> {
    if (!bullJob.id) {
      throw new Error(`Job missing ID: ${bullJob.name}`);
    }
    return {
      id: bullJob.id,
      name: bullJob.name,
      data: bullJob.data,
      attemptsMade: bullJob.attemptsMade,
      maxAttempts: bullJob.opts.attempts ?? BullMqAdapter.DEFAULT_MAX_ATTEMPTS,
      timestamp: bullJob.timestamp,
      processedOn: bullJob.processedOn,
      finishedOn: bullJob.finishedOn,
      failedReason: bullJob.failedReason,
      idempotencyKey: typeof bullJob.opts.jobId === 'string' ? bullJob.opts.jobId : undefined,
    };
  }
}
