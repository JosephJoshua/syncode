import {
  CONTROL_API,
  type SessionFeedbackProgressResponse,
  sessionFeedbackProgressResponseSchema,
} from '@syncode/contracts';
import { api } from '@/lib/api-client.js';

export type SessionFeedbackProgress = SessionFeedbackProgressResponse;
export type SessionFeedbackProgressTarget = SessionFeedbackProgress['targets'][number];

export async function fetchSessionFeedbackProgress(
  sessionId: string,
): Promise<SessionFeedbackProgress> {
  const response = await api(CONTROL_API.FEEDBACK.GET_PROGRESS, {
    params: { id: sessionId },
  });

  return sessionFeedbackProgressResponseSchema.parse(response);
}

export async function skipSessionFeedbackTarget(
  sessionId: string,
  candidateId: string,
): Promise<SessionFeedbackProgress> {
  const response = await api(CONTROL_API.FEEDBACK.SKIP_SESSION, {
    params: { id: sessionId },
    body: { candidateId },
  });

  return sessionFeedbackProgressResponseSchema.parse(response);
}

export async function skipAllSessionFeedbackTargets(
  sessionId: string,
): Promise<SessionFeedbackProgress> {
  const response = await api(CONTROL_API.FEEDBACK.SKIP_ALL_SESSION, {
    params: { id: sessionId },
  });

  return sessionFeedbackProgressResponseSchema.parse(response);
}
