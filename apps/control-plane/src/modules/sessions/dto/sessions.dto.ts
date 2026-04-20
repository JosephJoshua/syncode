import {
  codeSnapshotSchema,
  codeSnapshotsResponseSchema,
  listSessionsQuerySchema,
  sessionDetailSchema,
  sessionHistoryResponseSchema,
  sessionReportSchema,
  sessionSummarySchema,
} from '@syncode/contracts';
import { createZodDto } from 'nestjs-zod';

export class ListSessionsQueryDto extends createZodDto(listSessionsQuerySchema) {}
export class CodeSnapshotDto extends createZodDto(codeSnapshotSchema) {}
export class CodeSnapshotsResponseDto extends createZodDto(codeSnapshotsResponseSchema) {}
export class SessionSummaryDto extends createZodDto(sessionSummarySchema) {}
export class SessionHistoryResponseDto extends createZodDto(sessionHistoryResponseSchema) {}
export class SessionDetailDto extends createZodDto(sessionDetailSchema) {}
export class SessionReportDto extends createZodDto(sessionReportSchema) {}
