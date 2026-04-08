import type { SUPPORTED_LANGUAGES } from '../constants.js';

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

export interface ExecutionResult {
  requestId: string;
  status: 'completed' | 'failed';
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  timedOut: boolean;
  error?: string;
  cpuTimeMs?: number;
  memoryUsageMb?: number;
  outputTruncated?: boolean;
}
