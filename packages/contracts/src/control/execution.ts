import { z } from 'zod';

export const JOB_STATUSES = ['queued', 'running', 'completed', 'failed'] as const;

export const EXECUTION_RESULT_STATUSES = ['completed', 'failed'] as const;

export const executionResultResponseSchema = z.object({
  status: z
    .enum(EXECUTION_RESULT_STATUSES)
    .describe('Execution outcome')
    .meta({ examples: ['completed'] }),
  stdout: z
    .string()
    .describe('Standard output')
    .meta({ examples: ['Hello, World!\n'] }),
  stderr: z
    .string()
    .describe('Standard error output')
    .meta({ examples: [''] }),
  exitCode: z
    .number()
    .describe('Process exit code')
    .meta({ examples: [0] }),
  durationMs: z
    .number()
    .describe('Execution wall-clock duration (ms)')
    .meta({ examples: [42] }),
  timedOut: z
    .boolean()
    .describe('Whether execution was killed due to timeout')
    .meta({ examples: [false] }),
  error: z
    .string()
    .optional()
    .describe('Error message if execution failed')
    .meta({ examples: ['RuntimeError: division by zero'] }),
  cpuTimeMs: z
    .number()
    .optional()
    .describe('CPU time consumed (ms)')
    .meta({ examples: [38] }),
  memoryUsageMb: z
    .number()
    .optional()
    .describe('Peak memory usage (MB)')
    .meta({ examples: [12.5] }),
  outputTruncated: z
    .boolean()
    .optional()
    .describe('Whether stdout was truncated due to size limits')
    .meta({ examples: [false] }),
});

export type ExecutionResultResponse = z.infer<typeof executionResultResponseSchema>;

export const jobStatusResponseSchema = z.object({
  status: z
    .enum(JOB_STATUSES)
    .describe('Current job status')
    .meta({ examples: ['running'] }),
});

export type JobStatusResponse = z.infer<typeof jobStatusResponseSchema>;

export const executionTestCaseDetailSchema = z.object({
  testCaseIndex: z
    .number()
    .int()
    .describe('Zero-based test case index')
    .meta({ examples: [0] }),
  passed: z
    .boolean()
    .nullable()
    .describe('Whether the test case passed. null means no final verdict was recorded yet.')
    .meta({ examples: [true] }),
  expectedOutput: z
    .string()
    .nullable()
    .describe('Expected output for this test case')
    .meta({ examples: ['42'] }),
  actualOutput: z
    .string()
    .nullable()
    .describe('Actual output produced by the submission')
    .meta({ examples: ['41'] }),
  stdout: z
    .string()
    .nullable()
    .describe('Captured stdout for this test case')
    .meta({ examples: ['answer=41\\n'] }),
  stderr: z
    .string()
    .nullable()
    .describe('Captured stderr for this test case')
    .meta({ examples: [''] }),
  exitCode: z
    .number()
    .int()
    .nullable()
    .describe('Process exit code for this test case')
    .meta({ examples: [0] }),
  durationMs: z
    .number()
    .int()
    .nullable()
    .describe('Execution duration in milliseconds for this test case')
    .meta({ examples: [28] }),
  memoryUsageMb: z
    .number()
    .nullable()
    .describe('Peak memory usage in MB for this test case')
    .meta({ examples: [12.4] }),
  timedOut: z
    .boolean()
    .describe('Whether the test case execution timed out')
    .meta({ examples: [false] }),
  errorMessage: z
    .string()
    .nullable()
    .describe('Runtime or executor error message for this test case')
    .meta({ examples: ['RuntimeError: division by zero'] }),
});

export type ExecutionTestCaseDetail = z.infer<typeof executionTestCaseDetailSchema>;

export const executionDetailsResponseSchema = z.object({
  submissionId: z
    .uuid()
    .describe('Submission identifier')
    .meta({ examples: ['550e8400-e29b-41d4-a716-446655440000'] }),
  status: z
    .enum(['pending', 'running', 'completed', 'failed'])
    .describe('Current submission status')
    .meta({ examples: ['completed'] }),
  totalTestCases: z
    .number()
    .int()
    .describe('Total number of test cases in the submission')
    .meta({ examples: [3] }),
  passedTestCases: z
    .number()
    .int()
    .describe('Number of passed test cases')
    .meta({ examples: [2] }),
  failedTestCases: z
    .number()
    .int()
    .describe('Number of failed test cases')
    .meta({ examples: [1] }),
  errorTestCases: z
    .number()
    .int()
    .describe('Number of test cases that ended with execution errors')
    .meta({ examples: [0] }),
  totalDurationMs: z
    .number()
    .int()
    .nullable()
    .describe('Total duration in ms for all completed test cases')
    .meta({ examples: [84] }),
  submittedAt: z
    .string()
    .datetime()
    .describe('ISO 8601 timestamp when submission was created')
    .meta({ examples: ['2026-03-03T12:00:00.000Z'] }),
  completedAt: z
    .string()
    .datetime()
    .nullable()
    .describe('ISO 8601 timestamp when submission finished, null if still running')
    .meta({ examples: ['2026-03-03T12:00:02.000Z'] }),
  testCases: z
    .array(executionTestCaseDetailSchema)
    .describe('Per-test-case execution breakdown in ascending index order'),
});

export type ExecutionDetailsResponse = z.infer<typeof executionDetailsResponseSchema>;
