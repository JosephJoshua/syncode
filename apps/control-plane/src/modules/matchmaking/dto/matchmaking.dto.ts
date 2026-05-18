import {
  enterMatchmakingQueueSchema,
  leaveMatchmakingQueueResponseSchema,
  matchmakingPreferencesSchema,
} from '@syncode/contracts';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class EnterMatchmakingQueueDto extends createZodDto(enterMatchmakingQueueSchema) {}

const enterMatchmakingQueueResponseDtoSchema = z.object({
  status: z.enum(['searching', 'matched']),
  requestId: z.uuid(),
  queuePosition: z.number().int().positive().optional(),
  roomId: z.uuid().optional(),
  matchedWithUserId: z.uuid().optional(),
  expiresAt: z.iso.datetime(),
  preferences: matchmakingPreferencesSchema,
});

const getMatchmakingStatusResponseDtoSchema = z.object({
  status: z.enum(['idle', 'searching', 'matched']),
  requestId: z.uuid().optional(),
  queuePosition: z.number().int().positive().optional(),
  roomId: z.uuid().optional(),
  matchedWithUserId: z.uuid().optional(),
  expiresAt: z.iso.datetime().optional(),
  preferences: matchmakingPreferencesSchema.optional(),
});

export class EnterMatchmakingQueueResponseDto extends createZodDto(
  enterMatchmakingQueueResponseDtoSchema,
) {}

export class LeaveMatchmakingQueueResponseDto extends createZodDto(
  leaveMatchmakingQueueResponseSchema,
) {}

export class GetMatchmakingStatusResponseDto extends createZodDto(
  getMatchmakingStatusResponseDtoSchema,
) {}
