import {
  type EnterMatchmakingQueueResponse,
  enterMatchmakingQueueSchema,
  type GetMatchmakingStatusResponse,
  leaveMatchmakingQueueResponseSchema,
  matchmakingPreferencesSchema,
} from '@syncode/contracts';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class EnterMatchmakingQueueDto extends createZodDto(enterMatchmakingQueueSchema) {}

const matchmakingSearchingStatusDtoSchema = z.object({
  status: z.literal('searching'),
  requestId: z.uuid(),
  queuePosition: z.number().int().positive(),
  expiresAt: z.iso.datetime(),
  preferences: matchmakingPreferencesSchema,
});

const matchmakingMatchedStatusDtoSchema = z.object({
  status: z.literal('matched'),
  requestId: z.uuid(),
  roomId: z.uuid(),
  matchedWithUserId: z.uuid(),
  expiresAt: z.iso.datetime(),
  preferences: matchmakingPreferencesSchema,
});

const matchmakingIdleStatusDtoSchema = z.object({
  status: z.literal('idle'),
});

export class MatchmakingSearchingStatusDto extends createZodDto(
  matchmakingSearchingStatusDtoSchema,
) {}
export class MatchmakingMatchedStatusDto extends createZodDto(matchmakingMatchedStatusDtoSchema) {}
export class MatchmakingIdleStatusDto extends createZodDto(matchmakingIdleStatusDtoSchema) {}

export type EnterMatchmakingQueueResponseDto = EnterMatchmakingQueueResponse;

export class LeaveMatchmakingQueueResponseDto extends createZodDto(
  leaveMatchmakingQueueResponseSchema,
) {}

export type GetMatchmakingStatusResponseDto = GetMatchmakingStatusResponse;
