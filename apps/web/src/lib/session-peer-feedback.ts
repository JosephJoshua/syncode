import { defineRoute } from '@syncode/contracts';
import { z } from 'zod';
import { api } from '@/lib/api-client.js';
import { getSessionPeerFeedbackMockResponse } from '@/lib/session-peer-feedback.mock.js';

const feedbackUserSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  displayName: z.string().nullable(),
});

const peerFeedbackRatingsSchema = z.object({
  problemSolving: z.number().int().min(1).max(5),
  communication: z.number().int().min(1).max(5),
  codeQuality: z.number().int().min(1).max(5),
  debugging: z.number().int().min(1).max(5),
  overall: z.number().int().min(1).max(5),
});

const peerFeedbackEntrySchema = z.object({
  feedbackId: z.string().uuid(),
  fromUser: feedbackUserSchema,
  targetUser: feedbackUserSchema,
  ratings: peerFeedbackRatingsSchema,
  strengths: z.string(),
  improvements: z.string(),
  wouldPairAgain: z.boolean(),
  submittedAt: z.string().datetime(),
});

const getSessionFeedbackResponseSchema = z.object({
  data: z.array(peerFeedbackEntrySchema).optional(),
  allSubmitted: z.boolean().optional(),
});

const SESSION_FEEDBACK_ROUTE = defineRoute<void, GetSessionFeedbackResponse>()(
  'sessions/:sessionId/feedback',
  'GET',
);

export type FeedbackUser = z.infer<typeof feedbackUserSchema>;
export type PeerFeedbackRatings = z.infer<typeof peerFeedbackRatingsSchema>;
export type PeerFeedbackEntry = z.infer<typeof peerFeedbackEntrySchema>;
export type GetSessionFeedbackResponse = z.infer<typeof getSessionFeedbackResponseSchema>;

export async function fetchSessionPeerFeedback(
  sessionId: string,
): Promise<GetSessionFeedbackResponse> {
  const importMetaEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> })
    .env;
  const processEnv =
    typeof process !== 'undefined'
      ? (process.env as Record<string, string | undefined> | undefined)
      : undefined;
  const runtimeEnv = importMetaEnv || processEnv ? { ...processEnv, ...importMetaEnv } : undefined;

  if (runtimeEnv?.VITE_USE_PEER_FEEDBACK_API_MOCK === 'true') {
    return getSessionFeedbackResponseSchema.parse(
      getSessionPeerFeedbackMockResponse(runtimeEnv?.VITE_PEER_FEEDBACK_API_MOCK_STATE),
    );
  }

  const response = await api(SESSION_FEEDBACK_ROUTE, {
    params: { sessionId },
  });

  return getSessionFeedbackResponseSchema.parse(response);
}
