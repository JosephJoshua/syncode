import { z } from 'zod';

export const SESSION_FEEDBACK_STATUSES = ['submitted', 'skipped'] as const;
export const SESSION_FEEDBACK_PROGRESS_STATES = ['pending', ...SESSION_FEEDBACK_STATUSES] as const;

export const submitSessionFeedbackSchema = z.object({
  candidateId: z.uuid(),
  feedbackText: z.string().trim().min(1).max(2000),
});

export const skipSessionFeedbackSchema = z.object({
  candidateId: z.uuid(),
});

export const sessionFeedbackEntrySchema = submitSessionFeedbackSchema.extend({
  id: z.uuid(),
  sessionId: z.uuid(),
  roomId: z.uuid(),
  status: z.enum(SESSION_FEEDBACK_STATUSES),
  reviewerId: z.uuid(),
  reviewerName: z.string(),
  reviewerAvatarUrl: z.string().nullable().default(null),
  candidateName: z.string(),
  candidateAvatarUrl: z.string().nullable().default(null),
  createdAt: z.iso.datetime(),
});

export const sessionFeedbackProgressTargetSchema = z.object({
  candidateId: z.uuid(),
  candidateName: z.string(),
  candidateAvatarUrl: z.string().nullable().default(null),
  role: z.enum(['candidate', 'interviewer']),
  state: z.enum(SESSION_FEEDBACK_PROGRESS_STATES),
  createdAt: z.iso.datetime().nullable().default(null),
});

export const sessionFeedbackResponseSchema = z.object({
  allSubmitted: z.boolean(),
  data: z.array(sessionFeedbackEntrySchema),
});

export const sessionFeedbackProgressResponseSchema = z.object({
  allSubmitted: z.boolean(),
  targets: z.array(sessionFeedbackProgressTargetSchema),
});

export type SubmitSessionFeedbackInput = z.infer<typeof submitSessionFeedbackSchema>;
export type SkipSessionFeedbackInput = z.infer<typeof skipSessionFeedbackSchema>;
export type SessionFeedbackEntry = z.infer<typeof sessionFeedbackEntrySchema>;
export type SessionFeedbackResponse = z.infer<typeof sessionFeedbackResponseSchema>;
export type SessionFeedbackProgressTarget = z.infer<typeof sessionFeedbackProgressTargetSchema>;
export type SessionFeedbackProgressResponse = z.infer<typeof sessionFeedbackProgressResponseSchema>;
