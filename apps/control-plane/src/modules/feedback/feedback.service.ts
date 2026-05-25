import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  ERROR_CODES,
  type SkipSessionFeedbackInput,
  type SubmitSessionFeedbackInput,
} from '@syncode/contracts';
import type { Database } from '@syncode/db';
import { peerFeedback, sessionParticipants, sessions, users } from '@syncode/db';
import { type IStorageService, STORAGE_SERVICE } from '@syncode/shared/ports';
import { and, asc, eq, inArray, ne } from 'drizzle-orm';
import { resolveAvatarUrls } from '@/common/resolve-avatar-urls.js';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import {
  filterReviewFeedback,
  isAllReviewFeedbackSubmitted,
} from '@/modules/sessions/session-feedback-utils.js';
import type {
  SessionFeedbackEntryResult,
  SessionFeedbackProgressResult,
  SessionFeedbackProgressState,
  SessionFeedbackProgressTargetResult,
  SessionFeedbackResult,
  SessionFeedbackStatus,
} from './feedback.types.js';

@Injectable()
export class FeedbackService {
  constructor(
    @Inject(DB_CLIENT) private readonly db: Database,
    @Optional() @Inject(STORAGE_SERVICE) private readonly storageService?: IStorageService,
  ) {}

  async submitSessionFeedback(
    sessionId: string,
    reviewerId: string,
    input: SubmitSessionFeedbackInput,
    isAdmin: boolean,
  ): Promise<SessionFeedbackResult> {
    const session = await this.getFinishedSession(sessionId);
    this.assertPeerSession(session.mode);

    await this.assertReviewParticipant(sessionId, reviewerId);

    if (reviewerId === input.candidateId) {
      throw new BadRequestException({
        message: 'Reviewer and candidate must be different users',
        code: ERROR_CODES.VALIDATION_FAILED,
      });
    }

    await this.assertReviewParticipant(sessionId, input.candidateId);

    await this.upsertFeedbackRow({
      sessionId,
      roomId: session.roomId,
      reviewerId,
      candidateId: input.candidateId,
      status: 'submitted',
      feedbackText: input.feedbackText.trim(),
    });

    return this.getSessionFeedback(sessionId, reviewerId, isAdmin);
  }

  async skipSessionFeedback(
    sessionId: string,
    reviewerId: string,
    input: SkipSessionFeedbackInput,
  ): Promise<SessionFeedbackProgressResult> {
    const session = await this.getFinishedSession(sessionId);
    this.assertPeerSession(session.mode);
    await this.assertReviewParticipant(sessionId, reviewerId);

    if (reviewerId === input.candidateId) {
      throw new BadRequestException({
        message: 'Reviewer and candidate must be different users',
        code: ERROR_CODES.VALIDATION_FAILED,
      });
    }

    await this.assertReviewParticipant(sessionId, input.candidateId);

    const existingStatus = await this.getFeedbackStatusForTarget(
      session.roomId,
      reviewerId,
      input.candidateId,
    );
    if (existingStatus === 'submitted') {
      return this.getSessionFeedbackProgress(sessionId, reviewerId);
    }

    await this.upsertFeedbackRow({
      sessionId,
      roomId: session.roomId,
      reviewerId,
      candidateId: input.candidateId,
      status: 'skipped',
      feedbackText: null,
    });

    return this.getSessionFeedbackProgress(sessionId, reviewerId);
  }

  async skipAllSessionFeedback(
    sessionId: string,
    reviewerId: string,
  ): Promise<SessionFeedbackProgressResult> {
    const session = await this.getFinishedSession(sessionId);
    this.assertPeerSession(session.mode);
    await this.assertReviewParticipant(sessionId, reviewerId);

    const [participants, existingRows] = await Promise.all([
      this.getReviewParticipants(sessionId),
      this.getFeedbackRows(sessionId),
    ]);

    const existingByCandidateId = new Map(
      existingRows
        .filter((row) => row.reviewerId === reviewerId)
        .map((row) => [row.candidateId, row] as const),
    );

    for (const participant of participants) {
      if (participant.userId === reviewerId) {
        continue;
      }

      const existing = existingByCandidateId.get(participant.userId);
      if (existing?.status === 'submitted' || existing?.status === 'skipped') {
        continue;
      }

      await this.upsertFeedbackRow({
        sessionId,
        roomId: session.roomId,
        reviewerId,
        candidateId: participant.userId,
        status: 'skipped',
        feedbackText: null,
      });
    }

    return this.getSessionFeedbackProgress(sessionId, reviewerId);
  }

  async getSessionFeedback(
    sessionId: string,
    userId: string,
    isAdmin: boolean,
  ): Promise<SessionFeedbackResult> {
    const session = await this.getFinishedSession(sessionId);

    if (!isAdmin) {
      await this.assertParticipant(sessionId, userId);
    }

    if (session.mode !== 'peer') {
      return { allSubmitted: true, data: [] };
    }

    const [participants, feedback] = await Promise.all([
      this.getReviewParticipants(sessionId),
      this.getFeedbackRows(sessionId),
    ]);

    const reviewParticipantIds = new Set(participants.map((participant) => participant.userId));
    const resolvedFeedback = filterReviewFeedback(feedback, reviewParticipantIds);
    const allSubmitted = isAllReviewFeedbackSubmitted(
      reviewParticipantIds.size,
      resolvedFeedback.length,
    );
    const visibleFeedback = feedback.filter((entry) => entry.status === 'submitted');
    const scopedFeedback = isAdmin
      ? visibleFeedback
      : visibleFeedback.filter((entry) => allSubmitted || entry.reviewerId === userId);

    return { allSubmitted, data: scopedFeedback };
  }

  async getSessionFeedbackProgress(
    sessionId: string,
    userId: string,
  ): Promise<SessionFeedbackProgressResult> {
    const session = await this.getFinishedSession(sessionId);
    await this.assertParticipant(sessionId, userId);

    if (session.mode !== 'peer') {
      return { allSubmitted: true, targets: [] };
    }

    const reviewerParticipant = await this.getParticipantRole(sessionId, userId);
    if (!reviewerParticipant || reviewerParticipant.role === 'observer') {
      return { allSubmitted: true, targets: [] };
    }

    const [participants, feedback] = await Promise.all([
      this.getReviewParticipants(sessionId),
      this.getFeedbackRows(sessionId),
    ]);

    const reviewerEntries = new Map(
      feedback
        .filter((entry) => entry.reviewerId === userId)
        .map((entry) => [entry.candidateId, entry] as const),
    );

    const targets = participants
      .filter((participant) => participant.userId !== userId)
      .map((participant) => {
        const entry = reviewerEntries.get(participant.userId);
        return {
          candidateId: participant.userId,
          candidateName: participant.displayName ?? participant.username,
          candidateAvatarUrl: participant.avatarUrl,
          role: participant.role,
          state: (entry?.status ?? 'pending') as SessionFeedbackProgressState,
          createdAt: entry?.createdAt ?? null,
        } satisfies SessionFeedbackProgressTargetResult;
      });

    const allSubmitted = targets.every((target) => target.state !== 'pending');

    return { allSubmitted, targets };
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
      .select({ id: sessions.id, roomId: sessions.roomId, mode: sessions.mode })
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

  private async getParticipantRole(sessionId: string, userId: string) {
    return this.db.query.sessionParticipants.findFirst({
      columns: { role: true },
      where: (table, { and, eq }) => and(eq(table.sessionId, sessionId), eq(table.userId, userId)),
    });
  }

  private async assertReviewParticipant(sessionId: string, userId: string): Promise<void> {
    const participant = await this.db.query.sessionParticipants.findFirst({
      columns: { userId: true },
      where: (table, { and, eq, inArray }) =>
        and(
          eq(table.sessionId, sessionId),
          eq(table.userId, userId),
          inArray(table.role, ['candidate', 'interviewer']),
        ),
    });

    if (!participant) {
      throw new ForbiddenException({
        message: 'Only candidates and interviewers can submit peer feedback',
        code: ERROR_CODES.FORBIDDEN,
      });
    }
  }

  private assertPeerSession(mode: 'peer' | 'ai') {
    if (mode === 'peer') {
      return;
    }

    throw new ForbiddenException({
      message: 'This action is only available in peer interview mode',
      code: ERROR_CODES.ROOM_NOT_PEER_MODE,
    });
  }

  private async getReviewParticipants(sessionId: string) {
    const rows = await this.db
      .select({
        userId: sessionParticipants.userId,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        role: sessionParticipants.role,
        joinedAt: sessionParticipants.joinedAt,
      })
      .from(sessionParticipants)
      .innerJoin(users, eq(users.id, sessionParticipants.userId))
      .where(
        and(
          eq(sessionParticipants.sessionId, sessionId),
          inArray(sessionParticipants.role, ['candidate', 'interviewer']),
        ),
      )
      .orderBy(asc(sessionParticipants.joinedAt), asc(sessionParticipants.userId));

    const resolvedRows = await this.resolveAvatarRows(rows);

    return resolvedRows.map((row) => ({
      userId: row.userId,
      username: row.username,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      role: row.role as 'candidate' | 'interviewer',
      joinedAt: row.joinedAt,
    }));
  }

  private async getFeedbackStatusForTarget(
    roomId: string,
    reviewerId: string,
    candidateId: string,
  ): Promise<SessionFeedbackStatus | null> {
    const [row] = await this.db
      .select({ status: peerFeedback.status })
      .from(peerFeedback)
      .where(
        and(
          eq(peerFeedback.roomId, roomId),
          eq(peerFeedback.reviewerId, reviewerId),
          eq(peerFeedback.candidateId, candidateId),
        ),
      );

    return row ? row.status : null;
  }

  private async getFeedbackRows(sessionId: string): Promise<
    Array<
      SessionFeedbackEntryResult & {
        status: SessionFeedbackStatus;
      }
    >
  > {
    const rows = await this.db
      .select({
        id: peerFeedback.id,
        sessionId: peerFeedback.sessionId,
        roomId: peerFeedback.roomId,
        status: peerFeedback.status,
        reviewerId: peerFeedback.reviewerId,
        reviewerUsername: users.username,
        reviewerDisplayName: users.displayName,
        reviewerAvatarUrl: users.avatarUrl,
        candidateId: peerFeedback.candidateId,
        feedbackText: peerFeedback.feedbackText,
        strengths: peerFeedback.strengths,
        improvements: peerFeedback.improvements,
        createdAt: peerFeedback.createdAt,
      })
      .from(peerFeedback)
      .innerJoin(users, eq(users.id, peerFeedback.reviewerId))
      .where(eq(peerFeedback.sessionId, sessionId))
      .orderBy(asc(peerFeedback.createdAt), asc(peerFeedback.id));

    const candidateProfiles = await this.getUserProfiles(rows.map((row) => row.candidateId));
    const resolvedReviewerRows = await this.resolveAvatarRows(
      rows.map((row) => ({
        id: row.reviewerId,
        avatarUrl: row.reviewerAvatarUrl,
      })),
    );
    const reviewerAvatars = new Map(
      resolvedReviewerRows.map((row) => [row.id, row.avatarUrl] as const),
    );

    return rows.map((row) => ({
      id: row.id,
      sessionId: row.sessionId ?? sessionId,
      roomId: row.roomId,
      status: row.status,
      reviewerId: row.reviewerId,
      reviewerName: row.reviewerDisplayName ?? row.reviewerUsername,
      reviewerAvatarUrl: reviewerAvatars.get(row.reviewerId) ?? null,
      candidateId: row.candidateId,
      candidateName: candidateProfiles.get(row.candidateId)?.name ?? row.candidateId,
      candidateAvatarUrl: candidateProfiles.get(row.candidateId)?.avatarUrl ?? null,
      feedbackText:
        row.feedbackText ??
        [row.strengths, row.improvements]
          .filter((item): item is string => Boolean(item))
          .join('\n\n'),
      createdAt: row.createdAt,
    })) as Array<SessionFeedbackEntryResult & { status: SessionFeedbackStatus }>;
  }

  private async getUserProfiles(
    userIds: string[],
  ): Promise<Map<string, { name: string; avatarUrl: string | null }>> {
    if (userIds.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(inArray(users.id, [...new Set(userIds)]));

    const resolvedRows = await this.resolveAvatarRows(rows);

    return new Map(
      resolvedRows.map((row) => [
        row.id,
        {
          name: row.displayName ?? row.username,
          avatarUrl: row.avatarUrl,
        },
      ]),
    );
  }

  private async resolveAvatarRows<T extends { avatarUrl: string | null }>(rows: T[]): Promise<T[]> {
    if (!this.storageService) {
      return rows;
    }

    return resolveAvatarUrls(rows, this.storageService);
  }

  private async upsertFeedbackRow({
    candidateId,
    feedbackText,
    reviewerId,
    roomId,
    sessionId,
    status,
  }: {
    sessionId: string;
    roomId: string;
    reviewerId: string;
    candidateId: string;
    status: SessionFeedbackStatus;
    feedbackText: string | null;
  }) {
    const legacyStrength = status === 'submitted' ? (feedbackText?.slice(0, 2000) ?? null) : null;

    // A skip must never overwrite a row that already holds 'submitted'
    // feedback; otherwise a race between submitSessionFeedback and
    // skipAllSessionFeedback (which fetches a snapshot before looping)
    // would silently destroy submitted text. A submit, by contrast, can
    // freely override a prior 'skipped' status (the reviewer changes
    // their mind). The DB-level guard is the correct enforcement point
    // because the in-memory check in skipAllSessionFeedback is racy.
    const setWhere = status === 'skipped' ? ne(peerFeedback.status, 'submitted') : undefined;

    await this.db
      .insert(peerFeedback)
      .values({
        sessionId,
        roomId,
        reviewerId,
        candidateId,
        status,
        feedbackText,
        strengths: legacyStrength,
        improvements: null,
        wouldPairAgain: null,
        problemSolvingRating: null,
        communicationRating: null,
        codeQualityRating: null,
        debuggingRating: null,
        overallRating: null,
      })
      .onConflictDoUpdate({
        target: [peerFeedback.roomId, peerFeedback.reviewerId, peerFeedback.candidateId],
        setWhere,
        set: {
          sessionId,
          status,
          feedbackText,
          strengths: legacyStrength,
          improvements: null,
          wouldPairAgain: null,
          problemSolvingRating: null,
          communicationRating: null,
          codeQualityRating: null,
          debuggingRating: null,
          overallRating: null,
          createdAt: new Date(),
        },
      });
  }
}
