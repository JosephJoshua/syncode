import { z } from 'zod';
import { paginationSchema } from './pagination.js';

export const sessionHistoryParticipantSchema = z.object({
  userId: z.string(),
  role: z.string(),
  displayName: z.string().nullable().optional(),
  username: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
});

export const sessionSummarySchema = z.object({
  sessionId: z.string(),
  roomId: z.string(),
  mode: z.enum(['peer', 'ai']),
  problemTitle: z.string().nullable(),
  difficulty: z.string().nullable(),
  language: z.string().nullable(),
  duration: z.number().int().nonnegative(),
  participants: z.array(sessionHistoryParticipantSchema).default([]),
  overallScore: z.number().nullable().default(null),
  hasReport: z.boolean(),
  hasFeedback: z.boolean(),
  createdAt: z.string(),
  finishedAt: z.string().nullable().optional().default(null),
});

export const sessionHistoryResponseSchema = z.object({
  data: z.array(sessionSummarySchema).default([]),
  pagination: paginationSchema.default({
    nextCursor: null,
    hasMore: false,
  }),
});

export type SessionHistoryParticipant = z.infer<typeof sessionHistoryParticipantSchema>;
export type SessionSummary = z.infer<typeof sessionSummarySchema>;
export type SessionHistoryResponse = z.infer<typeof sessionHistoryResponseSchema>;
