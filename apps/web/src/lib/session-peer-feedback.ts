import {
  CONTROL_API,
  type SessionFeedbackEntry,
  type SessionFeedbackResponse,
  sessionFeedbackResponseSchema,
} from '@syncode/contracts';
import { api } from '@/lib/api-client.js';
import { getSessionPeerFeedbackMockResponse } from '@/lib/session-peer-feedback.mock.js';

export type PeerFeedbackEntry = SessionFeedbackEntry;
export type GetSessionFeedbackResponse = SessionFeedbackResponse;

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
    return sessionFeedbackResponseSchema.parse(
      getSessionPeerFeedbackMockResponse(runtimeEnv?.VITE_PEER_FEEDBACK_API_MOCK_STATE),
    );
  }

  const response = await api(CONTROL_API.FEEDBACK.GET_SESSION, {
    params: { id: sessionId },
  });

  return sessionFeedbackResponseSchema.parse(response);
}
