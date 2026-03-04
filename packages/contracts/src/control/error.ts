import { z } from 'zod';

export const errorResponseSchema = z.object({
  statusCode: z
    .number()
    .describe('HTTP status code')
    .meta({ examples: [500] }),
  message: z
    .string()
    .describe('Human-readable error message')
    .meta({ examples: ['Internal server error'] }),
  timestamp: z
    .string()
    .datetime()
    .describe('ISO 8601 timestamp')
    .meta({ examples: ['2026-03-03T12:00:00.000Z'] }),
  details: z
    .record(z.string(), z.any())
    .optional()
    .describe(
      'Additional error details. For validation errors: per-field error info. ' +
        'For circuit breaker errors: circuit name and retry timing.',
    ),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
