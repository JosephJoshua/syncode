import type { JobId, JobStatus, SubmitResult } from '../queues';
import type {
  GenerateHintRequest,
  GenerateHintResult,
  InterviewResponseRequest,
  InterviewResponseResult,
  ReviewCodeRequest,
  ReviewCodeResult,
} from './types';

export interface IAiClient {
  submitHintRequest(request: GenerateHintRequest): Promise<SubmitResult<'ai:hint'>>;
  getHintResult(jobId: JobId<'ai:hint'>): Promise<GenerateHintResult | null>;
  submitReviewRequest(request: ReviewCodeRequest): Promise<SubmitResult<'ai:review'>>;
  getReviewResult(jobId: JobId<'ai:review'>): Promise<ReviewCodeResult | null>;
  submitInterviewResponse(request: InterviewResponseRequest): Promise<SubmitResult<'ai:interview'>>;
  getInterviewResult(jobId: JobId<'ai:interview'>): Promise<InterviewResponseResult | null>;
  getJobStatus(jobId: JobId): Promise<JobStatus>;
  healthCheck(): Promise<boolean>;
}

export const AI_CLIENT = Symbol.for('AI_CLIENT');
