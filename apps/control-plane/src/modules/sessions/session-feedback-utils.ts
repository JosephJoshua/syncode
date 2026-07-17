/**
 * Shared utilities for session-feedback aggregation.
 *
 * Used by both the feedback module (PR #282) and the sessions detail page
 * (PR #281). Keeping these in a single place ensures the
 * "all reviewers submitted" calculation stays consistent across endpoints.
 */

export interface FeedbackEntry {
  reviewerId: string;
  candidateId: string;
}

/**
 * Compute the expected number of peer-feedback rows for a given set of review
 * participants. Each reviewer must submit one feedback per other reviewer, so
 * the expected count is `n * (n - 1)`.
 */
export function expectedReviewFeedbackCount(reviewParticipantCount: number): number {
  return reviewParticipantCount * Math.max(reviewParticipantCount - 1, 0);
}

/**
 * Filter raw feedback rows down to entries where both the reviewer and the
 * candidate are in the supplied review-participant set.
 */
export function filterReviewFeedback<T extends FeedbackEntry>(
  feedback: readonly T[],
  reviewParticipantIds: ReadonlySet<string>,
): T[] {
  return feedback.filter(
    (entry) =>
      reviewParticipantIds.has(entry.reviewerId) && reviewParticipantIds.has(entry.candidateId),
  );
}

/**
 * Determine whether every expected reviewer pairing has produced a feedback
 * row.
 */
export function isAllReviewFeedbackSubmitted(
  reviewParticipantCount: number,
  reviewFeedbackCount: number,
): boolean {
  const expected = expectedReviewFeedbackCount(reviewParticipantCount);
  return expected === 0 || reviewFeedbackCount >= expected;
}
