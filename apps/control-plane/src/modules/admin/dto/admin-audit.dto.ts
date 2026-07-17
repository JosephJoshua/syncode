import {
  adminAuditLogsQuerySchema,
  adminAuditLogsResponseSchema,
  auditLogSchema,
} from '@syncode/contracts';
import { createZodDto } from 'nestjs-zod';

export class AdminAuditLogsQueryDto extends createZodDto(adminAuditLogsQuerySchema) {}

export class AuditLogDto extends createZodDto(auditLogSchema) {}

export class AdminAuditLogsResponseDto extends createZodDto(adminAuditLogsResponseSchema) {}
