export const EXECUTION_QUEUE = 'execution.run-code';
export const STATIC_ANALYSIS_QUEUE = 'execution.static-analysis';

export const AI_HINT_QUEUE = 'ai.generate-hint';
export const AI_CODE_ANALYSIS_QUEUE = 'ai.code-analysis';
export const AI_WEAKNESS_ANALYSIS_QUEUE = 'ai.weakness-analysis';
export const AI_REVIEW_QUEUE = 'ai.review-code';
export const AI_INTERVIEW_QUEUE = 'ai.interview-response';
export const AI_INTERVIEW_TRANSCRIPTION_QUEUE = 'ai.interview-transcription';
export const AI_SESSION_REPORT_QUEUE = 'ai.session-report';
export const MATCHMAKING_ENGINE_QUEUE = 'matchmaking.engine';
export const ROOM_ABANDONED_CLEANUP_QUEUE = 'rooms.cleanup-abandoned';

export const EXECUTION_RESULT_QUEUE = 'execution.run-code.results';
export const STATIC_ANALYSIS_RESULT_QUEUE = 'execution.static-analysis.results';

export const AI_HINT_RESULT_QUEUE = 'ai.generate-hint.results';
export const AI_CODE_ANALYSIS_RESULT_QUEUE = 'ai.code-analysis.results';
export const AI_WEAKNESS_ANALYSIS_RESULT_QUEUE = 'ai.weakness-analysis.results';
export const AI_REVIEW_RESULT_QUEUE = 'ai.review-code.results';
export const AI_INTERVIEW_RESULT_QUEUE = 'ai.interview-response.results';
export const AI_INTERVIEW_TRANSCRIPTION_RESULT_QUEUE = 'ai.interview-transcription.results';
export const AI_SESSION_REPORT_RESULT_QUEUE = 'ai.session-report.results';

declare const __jobKind: unique symbol;
export type JobId<K extends string = string> = string & { readonly [__jobKind]?: K };

export interface SubmitResult<K extends string = string> {
  jobId: JobId<K>;
}

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';
