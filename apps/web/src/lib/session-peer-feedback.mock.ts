import type { GetSessionFeedbackResponse } from '@/lib/session-peer-feedback.js';

export type PeerFeedbackMockState = 'ready' | 'hidden' | 'empty';

const READY_SESSION_FEEDBACK_RESPONSE: GetSessionFeedbackResponse = {
  allSubmitted: true,
  data: [
    {
      feedbackId: '550e8400-e29b-41d4-a716-446655440000',
      fromUser: {
        id: '660e8400-e29b-41d4-a716-446655440000',
        username: 'excalibur64',
        displayName: 'Excalibur',
      },
      targetUser: {
        id: '770e8400-e29b-41d4-a716-446655440000',
        username: 'excalibur46',
        displayName: null,
      },
      ratings: {
        problemSolving: 4,
        communication: 5,
        codeQuality: 4,
        debugging: 3,
        overall: 4,
      },
      strengths: 'Clear explanation and strong problem decomposition.',
      improvements: 'Could explain edge cases earlier during the discussion.',
      wouldPairAgain: true,
      submittedAt: '2026-04-19T10:25:00.000Z',
    },
    {
      feedbackId: '880e8400-e29b-41d4-a716-446655440000',
      fromUser: {
        id: '990e8400-e29b-41d4-a716-446655440000',
        username: 'pairpilot',
        displayName: 'Pair Pilot',
      },
      targetUser: {
        id: 'aa0e8400-e29b-41d4-a716-446655440000',
        username: 'solverfox',
        displayName: 'Solver Fox',
      },
      ratings: {
        problemSolving: 5,
        communication: 4,
        codeQuality: 4,
        debugging: 4,
        overall: 5,
      },
      strengths: 'Stayed calm, explained trade-offs well, and validated assumptions clearly.',
      improvements: 'Could summarize the final approach more explicitly before submission.',
      wouldPairAgain: true,
      submittedAt: '2026-04-19T10:27:00.000Z',
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
