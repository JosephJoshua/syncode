import { PROBLEM_DIFFICULTIES, ROOM_MODES, ROOM_ROLES, SUPPORTED_LANGUAGES } from '@syncode/shared';
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

export const sessionReportEvidenceSchema = z.object({
  type: z.string(),
  reference: z.string(),
  description: z.string(),
});

export const sessionReportDimensionSchema = z.object({
  score: z.number().min(0).max(100),
  feedback: z.string(),
  evidence: z.array(sessionReportEvidenceSchema).default([]),
});

export const SESSION_REPORT_TREND_OPTIONS = ['improving', 'stable', 'declining'] as const;

export const sessionReportComparisonSchema = z.object({
  trend: z.enum(SESSION_REPORT_TREND_OPTIONS),
  sessionsCompared: z.number().int().nonnegative(),
  averageScore: z.number().min(0).max(100),
});

export const sessionReportPeerFeedbackSummarySchema = z.object({
  averageRating: z.number().min(0).max(5),
  wouldPairAgain: z.number().min(0).max(100),
  themes: z.array(z.string()).default([]),
});

export const sessionReportTestCaseBreakdownSchema = z.object({
  testCaseIndex: z
    .number()
    .int()
    .describe('Zero-based test case index')
    .meta({ examples: [0] }),
  passed: z
    .boolean()
    .nullable()
    .describe('Whether the test case passed. Null means no pass/fail verdict was recorded.')
    .meta({ examples: [true] }),
  timedOut: z
    .boolean()
    .describe('Whether execution hit the time limit for this test case')
    .meta({ examples: [false] }),
  errorMessage: z
    .string()
    .nullable()
    .describe(
      'Execution or compilation error details when available. Null for ordinary wrong-answer cases.',
    )
    .meta({ examples: ['Time limit exceeded'] }),
});

export const sessionReportSchema = z.object({
  sessionId: z.uuid().optional(),
  generatedAt: z.iso.datetime().optional(),
  overallScore: z.number().min(0).max(100).optional(),
  dimensions: z
    .object({
      correctness: sessionReportDimensionSchema.optional(),
      efficiency: sessionReportDimensionSchema.optional(),
      codeQuality: sessionReportDimensionSchema.optional(),
      communication: sessionReportDimensionSchema.optional(),
      problemSolving: sessionReportDimensionSchema.optional(),
    })
    .optional(),
  strengths: z.array(z.string()).optional(),
  areasForImprovement: z.array(z.string()).optional(),
  detailedFeedback: z.string().optional(),
  comparisonToHistory: sessionReportComparisonSchema.nullable().optional(),
  peerFeedbackSummary: sessionReportPeerFeedbackSummarySchema.nullable().optional(),
  testCaseBreakdown: z.array(sessionReportTestCaseBreakdownSchema).optional(),
});

export const sessionDetailSchema = z.object({
  sessionId: z.uuid(),
  roomId: z.uuid(),
  mode: z.enum(ROOM_MODES),
  problem: z
    .object({
      id: z.uuid(),
      title: z.string(),
      difficulty: z.enum(PROBLEM_DIFFICULTIES),
    })
    .nullable(),
  language: z.enum(SUPPORTED_LANGUAGES).nullable(),
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

export const CODE_SNAPSHOT_TRIGGERS = [
  'periodic',
  'phase_change',
  'submission',
  'manual',
  'session_end',
] as const;

export const codeSnapshotSchema = z.object({
  snapshotId: z.uuid(),
  timestamp: z.iso.datetime(),
  trigger: z.enum(CODE_SNAPSHOT_TRIGGERS),
  language: z.enum(SUPPORTED_LANGUAGES),
  code: z.string(),
  linesOfCode: z.number().int().nonnegative(),
});

export const listCodeSnapshotsQuerySchema = paginationQuerySchema.pick({
  cursor: true,
  limit: true,
});

export const codeSnapshotsResponseSchema = z.object({
  data: z.array(codeSnapshotSchema).default([]),
  pagination: paginationSchema,
});

export type SessionHistoryParticipant = z.infer<typeof sessionHistoryParticipantSchema>;
export type SessionSummary = z.infer<typeof sessionSummarySchema>;
export type SessionHistoryResponse = z.infer<typeof sessionHistoryResponseSchema>;
export type SessionParticipant = z.infer<typeof sessionParticipantSchema>;
export type SessionReport = z.infer<typeof sessionReportSchema>;
export type SessionDetail = z.infer<typeof sessionDetailSchema>;
export type CodeSnapshotTrigger = (typeof CODE_SNAPSHOT_TRIGGERS)[number];
export type CodeSnapshot = z.infer<typeof codeSnapshotSchema>;
export type CodeSnapshotsResponse = z.infer<typeof codeSnapshotsResponseSchema>;
export type SessionReportEvidence = z.infer<typeof sessionReportEvidenceSchema>;
export type SessionReportDimension = z.infer<typeof sessionReportDimensionSchema>;
export type SessionReportComparison = z.infer<typeof sessionReportComparisonSchema>;
export type SessionReportPeerFeedbackSummary = z.infer<
  typeof sessionReportPeerFeedbackSummarySchema
>;
export type SessionReportTestCaseBreakdownItem = z.infer<
  typeof sessionReportTestCaseBreakdownSchema
>;
export type SessionReportTrend = (typeof SESSION_REPORT_TREND_OPTIONS)[number];
export type ListCodeSnapshotsQuery = z.infer<typeof listCodeSnapshotsQuerySchema>;
