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
      status: 'submitted' as const,
      reviewerId: 'reviewer-1',
      reviewerName: 'Reviewer',
      reviewerAvatarUrl: null,
      candidateId: 'candidate-1',
      candidateName: 'Candidate',
      candidateAvatarUrl: null,
      feedbackText: 'Clear reasoning',
      createdAt: new Date('2026-04-01T00:00:00Z'),
    },
  ],
};

const PROGRESS_RESULT = {
  allSubmitted: false,
  targets: [
    {
      candidateId: 'candidate-1',
      candidateName: 'Candidate',
      candidateAvatarUrl: null,
      role: 'candidate' as const,
      state: 'pending' as const,
      createdAt: null,
    },
  ],
};

const FEEDBACK_BODY = {
  candidateId: 'candidate-1',
  feedbackText: 'Clear reasoning',
};

function createFixture() {
  const feedbackService: Pick<
    FeedbackService,
    | 'isAdmin'
    | 'submitSessionFeedback'
    | 'skipSessionFeedback'
    | 'skipAllSessionFeedback'
    | 'getSessionFeedback'
    | 'getSessionFeedbackProgress'
  > = {
    isAdmin: vi.fn(async () => false),
    submitSessionFeedback: vi.fn(async () => FEEDBACK_RESULT),
    skipSessionFeedback: vi.fn(async () => PROGRESS_RESULT),
    skipAllSessionFeedback: vi.fn(async () => ({ ...PROGRESS_RESULT, allSubmitted: true })),
    getSessionFeedback: vi.fn(async () => FEEDBACK_RESULT),
    getSessionFeedbackProgress: vi.fn(async () => PROGRESS_RESULT),
  };

  return {
    controller: new FeedbackController(feedbackService as FeedbackService),
    feedbackService,
  };
}

describe('FeedbackController', () => {
  it('GIVEN text feedback WHEN submitting THEN serializes createdAt and returns visibility state', async () => {
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
    expect(result.data[0].feedbackText).toBe('Clear reasoning');
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

  it('GIVEN feedback progress WHEN retrieving THEN serializes nullable timestamps', async () => {
    const { controller, feedbackService } = createFixture();

    const result = await controller.getSessionFeedbackProgress(AUTH_USER, 'session-1');

    expect(feedbackService.getSessionFeedbackProgress).toHaveBeenCalledWith(
      'session-1',
      'reviewer-1',
    );
    expect(result.targets[0]?.createdAt).toBeNull();
  });
});
