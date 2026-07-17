import { UserRole } from '@syncode/shared';
import { z } from 'zod';
import { paginationSchema } from './pagination.js';

export const adminUserStatusOptions = ['active', 'banned'] as const;

export const adminUsersQuerySchema = z.object({
  cursor: z.string().optional().describe('Opaque pagination cursor'),
  limit: z.coerce.number().int().min(1).max(100).default(20).describe('Page size'),
  search: z.string().trim().max(100).optional().describe('Search by username, email, or name'),
  status: z.enum(adminUserStatusOptions).optional().describe('Account status filter'),
});

export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;

export const adminUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  username: z.string(),
  displayName: z.string().nullable(),
  role: z.enum([UserRole.USER, UserRole.ADMIN]),
  avatarUrl: z.string().nullable(),
  bannedAt: z.iso.datetime().nullable(),
  bannedReason: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type AdminUser = z.infer<typeof adminUserSchema>;

export const adminUsersResponseSchema = z.object({
  data: z.array(adminUserSchema),
  pagination: paginationSchema,
});

export type AdminUsersResponse = z.infer<typeof adminUsersResponseSchema>;

export const adminBanUserSchema = z
  .object({
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export type AdminBanUserInput = z.infer<typeof adminBanUserSchema>;
