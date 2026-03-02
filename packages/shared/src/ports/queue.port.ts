export const QUEUE_SERVICE = Symbol.for('QUEUE_SERVICE');
export const QUEUE_SERVICE_KEY = 'QUEUE_SERVICE';

export interface QueueJobOptions {
  priority?: number;
  delay?: number;
  attempts?: number;
  backoff?: { type: 'exponential' | 'fixed'; delay: number };
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
  idempotencyKey?: string;
  ttl?: number;
}

export interface QueueJob<T = unknown> {
  id: string;
  name: string;
  data: T;
  attemptsMade: number;
  maxAttempts: number;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
  failedReason?: string;
  idempotencyKey?: string;
}

/**
 * Event handlers are fire-and-forget. The adapter must catch and log errors
 * in handlers to prevent crashing the worker process.
 */
export interface QueueEventHandler<T = unknown> {
  onCompleted?: (job: QueueJob<T>) => void;
  onFailed?: (job: QueueJob<T>, error: Error) => void;
  onDeadLetter?: (job: QueueJob<T>) => void;
  onStalled?: (jobId: string) => void;
}

export interface QueueProcessOptions {
  concurrency?: number;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

export interface IQueueService {
  enqueue<T>(
    queueName: string,
    jobName: string,
    data: T,
    options?: QueueJobOptions,
  ): Promise<string>;

  enqueueBulk<T>(
    queueName: string,
    jobs: Array<{ name: string; data: T; options?: QueueJobOptions }>,
  ): Promise<string[]>;

  process<T>(
    queueName: string,
    handler: (job: QueueJob<T>) => Promise<void>,
    options?: QueueProcessOptions,
  ): void;

  getJob<T>(queueName: string, jobId: string): Promise<QueueJob<T> | null>;

  getDeadLetterJobs(queueName: string, start?: number, end?: number): Promise<QueueJob[]>;

  retryDeadLetterJob(queueName: string, jobId: string): Promise<void>;
  retryAllDeadLetterJobs(queueName: string): Promise<number>;
  purgeDeadLetterQueue(queueName: string): Promise<number>;
  getQueueStats(queueName: string): Promise<QueueStats>;

  drain(queueName: string): Promise<void>;
  pause(queueName: string): Promise<void>;
  resume(queueName: string): Promise<void>;
  shutdown(): Promise<void>;

  registerEventHandlers(queueName: string, handlers: QueueEventHandler): void;
}
