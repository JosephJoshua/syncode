import type { JobId, JobStatus, SubmitResult } from '../queues.js';
import type { RunCodeRequest, RunCodeResult } from './types.js';

export interface IExecutionClient {
  submit(request: RunCodeRequest): Promise<SubmitResult<'execution'>>;
  getResult(jobId: JobId<'execution'>): Promise<RunCodeResult | null>;
  getJobStatus(jobId: JobId): Promise<JobStatus>;
  cancel(jobId: JobId): Promise<void>;
  healthCheck(): Promise<boolean>;
}

export const EXECUTION_CLIENT = Symbol.for('EXECUTION_CLIENT');
