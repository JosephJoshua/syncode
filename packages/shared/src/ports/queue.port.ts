export const QUEUE_SERVICE = Symbol.for('QUEUE_SERVICE');
export const QUEUE_SERVICE_KEY = 'QUEUE_SERVICE';

export interface QueueJobOptions {
  priority?: number;
  delay?: number;
  attempts?: number;
  backoff?: { type: 'exponential' | 'fixed'; delay: number };
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
}

export type QueueJobStatus = 'pending' | 'active' | 'completed' | 'failed';

export interface QueueFailedJob<T = unknown> {
  id: string;
  data: T;
  error: string;
}

export interface IQueueService<T = unknown> {
  enqueue(queueName: string, data: T, options?: QueueJobOptions): Promise<string>;
  process(queueName: string, handler: (data: T) => Promise<void>): Promise<void>;
  getJobStatus(queueName: string, jobId: string): Promise<QueueJobStatus | null>;
  cancelJob(queueName: string, jobId: string): Promise<void>;
  getFailedJobs(queueName: string, start?: number, end?: number): Promise<QueueFailedJob<T>[]>;
  pauseQueue(queueName: string): Promise<void>;
  resumeQueue(queueName: string): Promise<void>;
  drain(queueName: string): Promise<void>;
  shutdown(): Promise<void>;
}
