import type { GetSessionFeedbackResponse } from '@/lib/session-peer-feedback.js';

export type PeerFeedbackMockState = 'ready' | 'hidden' | 'empty';

const READY_SESSION_FEEDBACK_RESPONSE: GetSessionFeedbackResponse = {
  allSubmitted: true,
  data: [
    {
      id: '550e8400-e29b-41d4-a716-446655440000',
      sessionId: '110e8400-e29b-41d4-a716-446655440000',
      roomId: '120e8400-e29b-41d4-a716-446655440000',
      candidateId: '770e8400-e29b-41d4-a716-446655440000',
      reviewerId: '660e8400-e29b-41d4-a716-446655440000',
      reviewerName: 'Excalibur',
      reviewerAvatarUrl: null,
      candidateName: 'excalibur46',
      candidateAvatarUrl: null,
      status: 'submitted',
      feedbackText:
        'Clear explanation and strong problem decomposition.\n\nCould explain edge cases earlier during the discussion.',
      createdAt: '2026-04-19T10:25:00.000Z',
    },
    {
      id: '880e8400-e29b-41d4-a716-446655440000',
      sessionId: '110e8400-e29b-41d4-a716-446655440000',
      roomId: '120e8400-e29b-41d4-a716-446655440000',
      candidateId: 'aa0e8400-e29b-41d4-a716-446655440000',
      reviewerId: '990e8400-e29b-41d4-a716-446655440000',
      reviewerName: 'Pair Pilot',
      reviewerAvatarUrl: null,
      candidateName: 'Solver Fox',
      candidateAvatarUrl: null,
      status: 'submitted',
      feedbackText:
        'Stayed calm, explained trade-offs well, and validated assumptions clearly.\n\nCould summarize the final approach more explicitly before submission.',
      createdAt: '2026-04-19T10:27:00.000Z',
    },
  ],
};

const HIDDEN_SESSION_FEEDBACK_RESPONSE: GetSessionFeedbackResponse = {
  allSubmitted: false,
  data: [],
};

const EMPTY_SESSION_FEEDBACK_RESPONSE: GetSessionFeedbackResponse = {
  allSubmitted: true,
  data: [],
};

export function getSessionPeerFeedbackMockResponse(
  state: string | undefined,
): GetSessionFeedbackResponse {
  if (state === 'hidden') {
    return HIDDEN_SESSION_FEEDBACK_RESPONSE;
  }

  if (state === 'empty') {
    return EMPTY_SESSION_FEEDBACK_RESPONSE;
  }

  return READY_SESSION_FEEDBACK_RESPONSE;
}
