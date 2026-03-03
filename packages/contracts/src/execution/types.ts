import type { SupportedLanguage } from '@syncode/shared';

export interface RunCodeRequest {
  language: SupportedLanguage;
  code: string;
  stdin?: string;
  timeoutMs?: number;
  memoryMb?: number;
}

export interface RunCodeResult {
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
