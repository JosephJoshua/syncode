import type { SUPPORTED_LANGUAGES } from '../constants';

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export interface ExecutionRequest {
  requestId: string;
  userId: string;
  roomId?: string;
  language: SupportedLanguage;
  code: string;
  stdin?: string;
  timeoutMs?: number;
  memoryMb?: number;
}

export const ExecutionStatus = {
  PENDING: 'pending', // Submitted, not yet running
  RUNNING: 'running', // Sandbox executing code
  COMPLETED: 'completed', // Finished successfully
  FAILED: 'failed', // Execution error (sandbox-level, not code error)
  CANCELLED: 'cancelled', // User/system cancelled
} as const;

export type ExecutionStatus = (typeof ExecutionStatus)[keyof typeof ExecutionStatus];

export interface ExecutionResult {
  requestId: string;
  status: ExecutionStatus; // Always 'completed' or 'failed' when result exists
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  timedOut: boolean;
  error?: string; // Sandbox-level errors or cancellation reason
  cpuTimeMs?: number;
  memoryUsageMb?: number;
  outputTruncated?: boolean;
}
