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
