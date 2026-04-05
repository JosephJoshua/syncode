import { z } from 'zod';

export const ERROR_CODES = {
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  USER_BANNED: 'USER_BANNED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  ROOM_INVITE_CODE_EXHAUSTED: 'ROOM_INVITE_CODE_EXHAUSTED',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_ACCESS_DENIED: 'ROOM_ACCESS_DENIED',
  ROOM_INVALID_CODE: 'ROOM_INVALID_CODE',
  ROOM_FULL: 'ROOM_FULL',
  ROOM_ALREADY_JOINED: 'ROOM_ALREADY_JOINED',
  ROOM_FINISHED: 'ROOM_FINISHED',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
const errorCodeValues = Object.values(ERROR_CODES) as [ErrorCode, ...ErrorCode[]];

export const errorResponseSchema = z.object({
  statusCode: z
    .number()
    .describe('HTTP status code')
    .meta({ examples: [500] }),
  code: z
    .enum(errorCodeValues)
    .optional()
    .describe('Machine-readable error code')
    .meta({ examples: [ERROR_CODES.AUTH_INVALID_CREDENTIALS] }),
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
