import type { JobId, JobStatus, SubmitResult } from '../queues.js';
import type {
  AnalyzeCodeRequest,
  AnalyzeCodeResult,
  GenerateHintRequest,
  GenerateHintResult,
  GenerateSessionReportRequest,
  GenerateSessionReportResult,
  InterviewResponseRequest,
  InterviewResponseResult,
  ReviewCodeRequest,
  ReviewCodeResult,
} from './types.js';

export interface IAiClient {
  submitHintRequest(request: GenerateHintRequest): Promise<SubmitResult<'ai:hint'>>;
  getHintResult(jobId: JobId<'ai:hint'>): Promise<GenerateHintResult | null>;
  submitCodeAnalysisRequest(request: AnalyzeCodeRequest): Promise<SubmitResult<'ai:code-analysis'>>;
  getCodeAnalysisResult(jobId: JobId<'ai:code-analysis'>): Promise<AnalyzeCodeResult | null>;
  submitReviewRequest(request: ReviewCodeRequest): Promise<SubmitResult<'ai:review'>>;
  getReviewResult(jobId: JobId<'ai:review'>): Promise<ReviewCodeResult | null>;
  submitInterviewResponse(request: InterviewResponseRequest): Promise<SubmitResult<'ai:interview'>>;
  getInterviewResult(jobId: JobId<'ai:interview'>): Promise<InterviewResponseResult | null>;
  submitSessionReportRequest(
    request: GenerateSessionReportRequest,
  ): Promise<SubmitResult<'ai:session-report'>>;
  getSessionReportResult(
    jobId: JobId<'ai:session-report'>,
  ): Promise<GenerateSessionReportResult | null>;
  onSessionReportResult(
    callback: (jobId: string, result: GenerateSessionReportResult) => Promise<void>,
  ): void;
  getHintJobStatus(jobId: JobId<'ai:hint'>): Promise<JobStatus>;
  getCodeAnalysisJobStatus(jobId: JobId<'ai:code-analysis'>): Promise<JobStatus>;
  getReviewJobStatus(jobId: JobId<'ai:review'>): Promise<JobStatus>;
  getInterviewJobStatus(jobId: JobId<'ai:interview'>): Promise<JobStatus>;
  getSessionReportJobStatus(jobId: JobId<'ai:session-report'>): Promise<JobStatus>;
  healthCheck(): Promise<boolean>;
}

export const AI_CLIENT = Symbol.for('AI_CLIENT');
