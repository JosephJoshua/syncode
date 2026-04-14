export const EXEC_META_TTL_SECONDS = 24 * 60 * 60;
export const EXEC_META_KEY_PREFIX = 'exec-meta:';

export interface JobMeta {
  submissionId: string;
  testCaseIndex: number;
  expectedOutput: string;
}

export interface ExecutionTestCaseDetailResult {
  testCaseIndex: number;
  passed: boolean | null;
  expectedOutput: string | null;
  actualOutput: string | null;
  stdout: string | null;
  stderr: string | null;
  exitCode: number | null;
  durationMs: number | null;
  memoryUsageMb: number | null;
  timedOut: boolean;
  errorMessage: string | null;
}

export interface ExecutionDetailsResult {
  submissionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  totalTestCases: number;
  passedTestCases: number;
  failedTestCases: number;
  errorTestCases: number;
  totalDurationMs: number | null;
  submittedAt: Date;
  completedAt: Date | null;
  testCases: ExecutionTestCaseDetailResult[];
}
