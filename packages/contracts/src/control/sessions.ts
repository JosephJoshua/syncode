import { ROOM_MODES } from '@syncode/shared';
import { z } from 'zod';
import { paginationQuerySchema, paginationSchema } from './pagination.js';

export const SESSIONS_SORT_BY_OPTIONS = [
  'createdAt',
  'finishedAt',
  'overallScore',
  'duration',
] as const;

export const sessionHistoryParticipantSchema = z.object({
  userId: z.uuid(),
  username: z.string(),
  role: z.string(),
});

export const listSessionsQuerySchema = paginationQuerySchema.extend({
  mode: z.enum(ROOM_MODES).optional().describe('Filter by session mode'),
  fromDate: z.iso.datetime().optional().describe('Inclusive lower bound (ISO 8601)'),
  toDate: z.iso.datetime().optional().describe('Inclusive upper bound (ISO 8601)'),
  problemId: z.uuid().optional().describe('Filter by problem'),
  sortBy: z.enum(SESSIONS_SORT_BY_OPTIONS).default('createdAt').describe('Field to sort by'),
});

export type ListSessionsQuery = z.infer<typeof listSessionsQuerySchema>;

export const sessionSummarySchema = z.object({
  sessionId: z.uuid(),
  roomId: z.uuid(),
  mode: z.enum(ROOM_MODES),
  problemTitle: z.string().nullable(),
  difficulty: z.string().nullable(),
  language: z.string().nullable(),
  duration: z.number().int().nonnegative(),
  participants: z.array(sessionHistoryParticipantSchema).default([]),
  overallScore: z.number().nullable().default(null),
  hasReport: z.boolean(),
  hasFeedback: z.boolean(),
  createdAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable().default(null),
});

export const sessionHistoryResponseSchema = z.object({
  data: z.array(sessionSummarySchema).default([]),
  pagination: paginationSchema.default({
    nextCursor: null,
    hasMore: false,
  }),
});

export const sessionParticipantSchema = z.object({
  userId: z.uuid(),
  username: z.string(),
  displayName: z.string().nullable(),
  role: z.string(),
  joinedAt: z.iso.datetime(),
  leftAt: z.iso.datetime().nullable(),
});

export const sessionRunSchema = z.object({
  jobId: z.string(),
  status: z.enum(['completed', 'failed']),
  createdAt: z.iso.datetime(),
});

export const sessionSubmissionSchema = z.object({
  submissionId: z.uuid(),
  status: z.enum(['completed', 'failed']),
  passed: z.number().int(),
  total: z.number().int(),
  createdAt: z.iso.datetime(),
});

export const sessionDetailSchema = z.object({
  sessionId: z.uuid(),
  roomId: z.uuid(),
  mode: z.enum(ROOM_MODES),
  problem: z
    .object({
      id: z.uuid(),
      title: z.string(),
      difficulty: z.string(),
    })
    .nullable(),
  language: z.string().nullable(),
  duration: z.number().int().nonnegative(),
  participants: z.array(sessionParticipantSchema),
  runs: z.array(sessionRunSchema),
  submissions: z.array(sessionSubmissionSchema),
  hasReport: z.boolean(),
  hasFeedback: z.boolean(),
  hasRecording: z.boolean(),
  createdAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
});

export type SessionHistoryParticipant = z.infer<typeof sessionHistoryParticipantSchema>;
export type SessionSummary = z.infer<typeof sessionSummarySchema>;
export type SessionHistoryResponse = z.infer<typeof sessionHistoryResponseSchema>;
export type SessionParticipant = z.infer<typeof sessionParticipantSchema>;
export type SessionDetail = z.infer<typeof sessionDetailSchema>;
