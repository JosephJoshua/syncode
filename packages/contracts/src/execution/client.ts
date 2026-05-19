import type { JobId, JobStatus, SubmitResult } from '../queues.js';
import type {
  RunCodeRequest,
  RunCodeResult,
  StaticAnalysisRequest,
  StaticAnalysisResult,
} from './types.js';

export interface SubmitStaticAnalysisOptions {
  idempotencyKey?: JobId<'static-analysis'>;
}

export interface IExecutionClient {
  submit(request: RunCodeRequest): Promise<SubmitResult<'execution'>>;
  getResult(jobId: JobId<'execution'>): Promise<RunCodeResult | null>;
  getJobStatus(jobId: JobId): Promise<JobStatus>;
  submitStaticAnalysis(
    request: StaticAnalysisRequest,
    options?: SubmitStaticAnalysisOptions,
  ): Promise<SubmitResult<'static-analysis'>>;
  getStaticAnalysisResult(jobId: JobId<'static-analysis'>): Promise<StaticAnalysisResult | null>;
  getStaticAnalysisJobStatus(jobId: JobId): Promise<JobStatus>;
  cancel(jobId: JobId): Promise<void>;
  healthCheck(): Promise<boolean>;
  onResult(callback: (jobId: string, result: RunCodeResult) => Promise<void>): void;
  onStaticAnalysisResult(
    callback: (jobId: string, result: StaticAnalysisResult) => Promise<void>,
  ): void;
}

export const EXECUTION_CLIENT = Symbol.for('EXECUTION_CLIENT');
