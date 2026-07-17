import { z } from 'zod';
import { paginationQuerySchema, paginationSchema } from './pagination.js';
import { problemSummarySchema } from './problems.js';

export const listBookmarksQuerySchema = paginationQuerySchema.pick({
  cursor: true,
  limit: true,
});

export type ListBookmarksQuery = z.infer<typeof listBookmarksQuerySchema>;

export const listBookmarksResponseSchema = z.object({
  data: z.array(problemSummarySchema),
  pagination: paginationSchema,
});

export type ListBookmarksResponse = z.infer<typeof listBookmarksResponseSchema>;
