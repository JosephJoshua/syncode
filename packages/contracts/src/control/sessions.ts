import { ROOM_MODES, ROOM_ROLES, SUPPORTED_LANGUAGES } from '@syncode/shared';
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
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  role: z.enum(ROOM_ROLES),
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
  role: z.enum(ROOM_ROLES),
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

export const sessionReportSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  categoryScores: z.record(z.string(), z.number().int().min(0).max(100)),
  strengths: z.array(z.string()).default([]),
  areasForImprovement: z.array(z.string()).default([]),
  feedback: z.string(),
  generatedAt: z.iso.datetime(),
});

export const sessionCodeSnapshotSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  language: z.enum(SUPPORTED_LANGUAGES),
  trigger: z.string(),
  linesOfCode: z.number().int().nullable(),
  createdAt: z.iso.datetime(),
});

export const sessionPeerFeedbackSchema = z.object({
  id: z.uuid(),
  reviewerId: z.uuid(),
  reviewerName: z.string(),
  candidateId: z.uuid(),
  candidateName: z.string(),
  problemSolvingRating: z.number().int().min(1).max(5),
  communicationRating: z.number().int().min(1).max(5),
  codeQualityRating: z.number().int().min(1).max(5),
  debuggingRating: z.number().int().min(1).max(5),
  overallRating: z.number().int().min(1).max(5),
  strengths: z.string(),
  improvements: z.string(),
  wouldPairAgain: z.boolean(),
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
  report: sessionReportSchema.nullable(),
  latestCodeSnapshot: sessionCodeSnapshotSchema.nullable(),
  peerFeedback: z.array(sessionPeerFeedbackSchema).default([]),
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
export type SessionReport = z.infer<typeof sessionReportSchema>;
export type SessionCodeSnapshot = z.infer<typeof sessionCodeSnapshotSchema>;
export type SessionPeerFeedback = z.infer<typeof sessionPeerFeedbackSchema>;
export type SessionDetail = z.infer<typeof sessionDetailSchema>;
