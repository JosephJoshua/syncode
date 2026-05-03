import { z } from 'zod';

const ratingSchema = z.number().int().min(1).max(5);

export const submitSessionFeedbackSchema = z.object({
  candidateId: z.uuid(),
  problemSolvingRating: ratingSchema,
  communicationRating: ratingSchema,
  codeQualityRating: ratingSchema,
  debuggingRating: ratingSchema,
  overallRating: ratingSchema,
  strengths: z.string().trim().min(1).max(2000),
  improvements: z.string().trim().min(1).max(2000),
  wouldPairAgain: z.boolean(),
});

export const sessionFeedbackEntrySchema = submitSessionFeedbackSchema.extend({
  id: z.uuid(),
  sessionId: z.uuid(),
  roomId: z.uuid(),
  reviewerId: z.uuid(),
  reviewerName: z.string(),
  reviewerAvatarUrl: z.string().nullable(),
  candidateName: z.string(),
  candidateAvatarUrl: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export const sessionFeedbackResponseSchema = z.object({
  allSubmitted: z.boolean(),
  data: z.array(sessionFeedbackEntrySchema),
});

export type SubmitSessionFeedbackInput = z.infer<typeof submitSessionFeedbackSchema>;
export type SessionFeedbackEntry = z.infer<typeof sessionFeedbackEntrySchema>;
export type SessionFeedbackResponse = z.infer<typeof sessionFeedbackResponseSchema>;
