import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ERROR_CODES, type SubmitSessionFeedbackInput } from '@syncode/contracts';
import type { Database } from '@syncode/db';
import { peerFeedback, sessionParticipants, sessions, users } from '@syncode/db';
import { and, eq, inArray } from 'drizzle-orm';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import type { SessionFeedbackEntryResult, SessionFeedbackResult } from './feedback.types.js';

@Injectable()
export class FeedbackService {
  constructor(@Inject(DB_CLIENT) private readonly db: Database) {}

  async submitSessionFeedback(
    sessionId: string,
    reviewerId: string,
    input: SubmitSessionFeedbackInput,
    isAdmin: boolean,
  ): Promise<SessionFeedbackResult> {
    const session = await this.getFinishedSession(sessionId);

    if (!isAdmin) {
      await this.assertParticipant(sessionId, reviewerId);
    }

    if (reviewerId === input.candidateId) {
      throw new BadRequestException({
        message: 'Reviewer and candidate must be different users',
        code: ERROR_CODES.VALIDATION_FAILED,
      });
    }

    await this.assertParticipant(sessionId, input.candidateId);

    try {
      await this.db.insert(peerFeedback).values({
        sessionId,
        roomId: session.roomId,
        reviewerId,
        candidateId: input.candidateId,
        problemSolvingRating: input.problemSolvingRating,
        communicationRating: input.communicationRating,
        codeQualityRating: input.codeQualityRating,
        debuggingRating: input.debuggingRating,
        overallRating: input.overallRating,
        strengths: input.strengths,
        improvements: input.improvements,
        wouldPairAgain: input.wouldPairAgain,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          message: 'Feedback already submitted for this participant',
          code: ERROR_CODES.FEEDBACK_ALREADY_SUBMITTED,
        });
      }

      throw error;
    }

    return this.getSessionFeedback(sessionId, reviewerId, isAdmin);
  }

  async getSessionFeedback(
    sessionId: string,
    userId: string,
    isAdmin: boolean,
  ): Promise<SessionFeedbackResult> {
    await this.getFinishedSession(sessionId);

    if (!isAdmin) {
      await this.assertParticipant(sessionId, userId);
    }

    const [participants, feedback] = await Promise.all([
      this.getReviewParticipants(sessionId),
      this.getFeedbackRows(sessionId),
    ]);

    const expectedCount = participants.length * Math.max(participants.length - 1, 0);
    const allSubmitted = expectedCount > 0 && feedback.length >= expectedCount;
    const visibleFeedback =
      isAdmin || allSubmitted ? feedback : feedback.filter((entry) => entry.reviewerId === userId);

    return { allSubmitted, data: visibleFeedback };
  }

  async isAdmin(userId: string): Promise<boolean> {
    const user = await this.db.query.users.findFirst({
      columns: { role: true },
      where: (table, { eq }) => eq(table.id, userId),
    });
    return user?.role === 'admin';
  }

  private async getFinishedSession(sessionId: string) {
    const [session] = await this.db
      .select({ id: sessions.id, roomId: sessions.roomId })
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.status, 'finished')));

    if (!session) {
      throw new NotFoundException({
        message: 'Session not found',
        code: ERROR_CODES.SESSION_NOT_FOUND,
      });
    }

    return session;
  }

  private async assertParticipant(sessionId: string, userId: string): Promise<void> {
    const participant = await this.db.query.sessionParticipants.findFirst({
      columns: { userId: true },
      where: (table, { and, eq }) => and(eq(table.sessionId, sessionId), eq(table.userId, userId)),
    });

    if (!participant) {
      throw new ForbiddenException({
        message: 'Not a participant of this session',
        code: ERROR_CODES.SESSION_NOT_PARTICIPANT,
      });
    }
  }

  private async getReviewParticipants(sessionId: string) {
    return this.db
      .select({ userId: sessionParticipants.userId })
      .from(sessionParticipants)
      .where(
        and(
          eq(sessionParticipants.sessionId, sessionId),
          inArray(sessionParticipants.role, ['candidate', 'interviewer']),
        ),
      );
  }

  private async getFeedbackRows(sessionId: string): Promise<SessionFeedbackEntryResult[]> {
    const rows = await this.db
      .select({
        id: peerFeedback.id,
        sessionId: peerFeedback.sessionId,
        roomId: peerFeedback.roomId,
        reviewerId: peerFeedback.reviewerId,
        reviewerUsername: users.username,
        reviewerDisplayName: users.displayName,
        candidateId: peerFeedback.candidateId,
        problemSolvingRating: peerFeedback.problemSolvingRating,
        communicationRating: peerFeedback.communicationRating,
        codeQualityRating: peerFeedback.codeQualityRating,
        debuggingRating: peerFeedback.debuggingRating,
        overallRating: peerFeedback.overallRating,
        strengths: peerFeedback.strengths,
        improvements: peerFeedback.improvements,
        wouldPairAgain: peerFeedback.wouldPairAgain,
        createdAt: peerFeedback.createdAt,
      })
      .from(peerFeedback)
      .innerJoin(users, eq(users.id, peerFeedback.reviewerId))
      .where(eq(peerFeedback.sessionId, sessionId));

    const candidateNames = await this.getUserNames(rows.map((row) => row.candidateId));

    return rows.map((row) => ({
      id: row.id,
      sessionId: row.sessionId ?? sessionId,
      roomId: row.roomId,
      reviewerId: row.reviewerId,
      reviewerName: row.reviewerDisplayName ?? row.reviewerUsername,
      candidateId: row.candidateId,
      candidateName: candidateNames.get(row.candidateId) ?? row.candidateId,
      problemSolvingRating: row.problemSolvingRating,
      communicationRating: row.communicationRating,
      codeQualityRating: row.codeQualityRating,
      debuggingRating: row.debuggingRating,
      overallRating: row.overallRating,
      strengths: row.strengths,
      improvements: row.improvements,
      wouldPairAgain: row.wouldPairAgain,
      createdAt: row.createdAt,
    }));
  }

  private async getUserNames(userIds: string[]): Promise<Map<string, string>> {
    if (userIds.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .select({ id: users.id, username: users.username, displayName: users.displayName })
      .from(users)
      .where(inArray(users.id, [...new Set(userIds)]));

    return new Map(rows.map((row) => [row.id, row.displayName ?? row.username]));
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  if ('code' in error && (error as { code?: unknown }).code === '23505') {
    return true;
  }

  return 'cause' in error && isUniqueViolation((error as { cause?: unknown }).cause);
}
