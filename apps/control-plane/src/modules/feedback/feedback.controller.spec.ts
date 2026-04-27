import { describe, expect, it, vi } from 'vitest';
import { FeedbackController } from './feedback.controller.js';
import type { FeedbackService } from './feedback.service.js';

const AUTH_USER = { id: 'reviewer-1', email: 'reviewer@example.com' };
const FEEDBACK_RESULT = {
  allSubmitted: false,
  data: [
    {
      id: 'feedback-1',
      sessionId: 'session-1',
      roomId: 'room-1',
      reviewerId: 'reviewer-1',
      reviewerName: 'Reviewer',
      candidateId: 'candidate-1',
      candidateName: 'Candidate',
      problemSolvingRating: 4,
      communicationRating: 5,
      codeQualityRating: 4,
      debuggingRating: 3,
      overallRating: 4,
      strengths: 'Clear reasoning',
      improvements: 'Name edge cases earlier',
      wouldPairAgain: true,
      createdAt: new Date('2026-04-01T00:00:00Z'),
    },
  ],
};

const FEEDBACK_BODY = {
  candidateId: 'candidate-1',
  problemSolvingRating: 4,
  communicationRating: 5,
  codeQualityRating: 4,
  debuggingRating: 3,
  overallRating: 4,
  strengths: 'Clear reasoning',
  improvements: 'Name edge cases earlier',
  wouldPairAgain: true,
};

function createFixture() {
  const feedbackService: Pick<
    FeedbackService,
    'isAdmin' | 'submitSessionFeedback' | 'getSessionFeedback'
  > = {
    isAdmin: vi.fn(async () => false),
    submitSessionFeedback: vi.fn(async () => FEEDBACK_RESULT),
    getSessionFeedback: vi.fn(async () => FEEDBACK_RESULT),
  };

  return {
    controller: new FeedbackController(feedbackService as FeedbackService),
    feedbackService,
  };
}

describe('FeedbackController', () => {
  it('GIVEN structured feedback WHEN submitting THEN serializes createdAt and returns visibility state', async () => {
    const { controller, feedbackService } = createFixture();

    const result = await controller.submitSessionFeedback(AUTH_USER, 'session-1', FEEDBACK_BODY);

    expect(feedbackService.submitSessionFeedback).toHaveBeenCalledWith(
      'session-1',
      'reviewer-1',
      FEEDBACK_BODY,
      false,
    );
    expect(result.allSubmitted).toBe(false);
    expect(result.data[0].createdAt).toBe('2026-04-01T00:00:00.000Z');
  });

  it('GIVEN a session id WHEN retrieving feedback THEN serializes createdAt and returns entries', async () => {
    const { controller, feedbackService } = createFixture();

    const result = await controller.getSessionFeedback(AUTH_USER, 'session-1');

    expect(feedbackService.getSessionFeedback).toHaveBeenCalledWith(
      'session-1',
      'reviewer-1',
      false,
    );
    expect(result.data[0].reviewerName).toBe('Reviewer');
    expect(result.data[0].createdAt).toBe('2026-04-01T00:00:00.000Z');
  });
});
