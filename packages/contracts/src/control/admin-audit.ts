import { z } from 'zod';
import { paginationSchema } from './pagination.js';

export const auditActorSchema = z.object({
  id: z.uuid(),
  username: z.string(),
  email: z.email(),
  displayName: z.string().nullable(),
});

export type AuditActor = z.infer<typeof auditActorSchema>;

export const auditLogSchema = z.object({
  id: z.uuid(),
  actorId: z.uuid().nullable(),
  actor: auditActorSchema.nullable(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string(),
  metadata: z.unknown().nullable(),
  ipAddress: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export type AuditLog = z.infer<typeof auditLogSchema>;

export const adminAuditLogsQuerySchema = z.object({
  cursor: z.string().optional().describe('Opaque pagination cursor'),
  limit: z.coerce.number().int().min(1).max(100).default(20).describe('Page size'),
  search: z.string().trim().max(100).optional().describe('Search action, target, or actor'),
  action: z.string().trim().max(100).optional().describe('Filter by action'),
  actorId: z.uuid().optional().describe('Filter by actor user ID'),
  targetId: z.string().trim().max(255).optional().describe('Filter by target ID'),
  from: z.iso.datetime().optional().describe('Created-at lower bound'),
  to: z.iso.datetime().optional().describe('Created-at upper bound'),
});

export type AdminAuditLogsQuery = z.infer<typeof adminAuditLogsQuerySchema>;

export const adminAuditLogsResponseSchema = z.object({
  data: z.array(auditLogSchema),
  pagination: paginationSchema,
});

export type AdminAuditLogsResponse = z.infer<typeof adminAuditLogsResponseSchema>;
