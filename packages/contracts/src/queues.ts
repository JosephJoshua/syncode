export const EXECUTION_QUEUE = 'execution:run-code';

export const AI_HINT_QUEUE = 'ai:generate-hint';
export const AI_REVIEW_QUEUE = 'ai:review-code';
export const AI_INTERVIEW_QUEUE = 'ai:interview-response';

export const EXECUTION_RESULT_QUEUE = 'execution:run-code:results';

export const AI_HINT_RESULT_QUEUE = 'ai:generate-hint:results';
export const AI_REVIEW_RESULT_QUEUE = 'ai:review-code:results';
export const AI_INTERVIEW_RESULT_QUEUE = 'ai:interview-response:results';

declare const __jobKind: unique symbol;
export type JobId<K extends string = string> = string & { readonly [__jobKind]?: K };

export interface SubmitResult<K extends string = string> {
  jobId: JobId<K>;
}

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';
