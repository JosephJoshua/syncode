import { z } from 'zod';

export const SORT_ORDER_OPTIONS = ['asc', 'desc'] as const;

export const paginationQuerySchema = z.object({
  cursor: z.string().optional().describe('Opaque pagination cursor'),
  limit: z.coerce.number().int().min(1).max(100).default(20).describe('Page size'),
  sortOrder: z.enum(SORT_ORDER_OPTIONS).default('desc').describe('Sort direction'),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const paginationSchema = z.object({
  nextCursor: z.string().nullable().describe('Opaque cursor for fetching the next page'),
  hasMore: z.boolean().describe('Whether more items exist beyond this page'),
});

export type Pagination = z.infer<typeof paginationSchema>;
