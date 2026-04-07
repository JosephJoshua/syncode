import {
  listSessionsQuerySchema,
  sessionDetailSchema,
  sessionHistoryResponseSchema,
  sessionSummarySchema,
} from '@syncode/contracts';
import { createZodDto } from 'nestjs-zod';

export class ListSessionsQueryDto extends createZodDto(listSessionsQuerySchema) {}
export class SessionSummaryDto extends createZodDto(sessionSummarySchema) {}
export class SessionHistoryResponseDto extends createZodDto(sessionHistoryResponseSchema) {}
export class SessionDetailDto extends createZodDto(sessionDetailSchema) {}
