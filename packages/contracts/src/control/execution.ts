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
