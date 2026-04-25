import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ERROR_CODES } from '@syncode/contracts';
import type { Database } from '@syncode/db';
import { peerFeedback } from '@syncode/db';
import { and, eq } from 'drizzle-orm';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import {
  createTestDb,
  insertPeerFeedbackRow,
  insertRoom,
  insertSession,
  insertSessionParticipant,
  insertUser,
} from '@/test/integration-setup.js';
import { FeedbackService } from './feedback.service.js';

let db: Database;
let cleanup: () => Promise<void>;
let service: FeedbackService;

const FEEDBACK_INPUT = {
  candidateId: '',
  problemSolvingRating: 4,
  communicationRating: 5,
  codeQualityRating: 4,
  debuggingRating: 3,
  overallRating: 4,
  strengths: 'Explained the approach clearly',
  improvements: 'Call out edge cases earlier',
  wouldPairAgain: true,
};

beforeEach(async () => {
  const testDb = await createTestDb();
  db = testDb.db;
  cleanup = testDb.cleanup;

  const module = await Test.createTestingModule({
    providers: [FeedbackService, { provide: DB_CLIENT, useValue: db }],
  }).compile();

  service = module.get(FeedbackService);
});

afterEach(async () => {
  await cleanup();
});

async function seedPeerSession() {
  const reviewer = await insertUser(db, { displayName: 'Reviewer' });
  const candidate = await insertUser(db, { displayName: 'Candidate' });
  const observer = await insertUser(db, { displayName: 'Observer' });
  const room = await insertRoom(db, reviewer.id);
  const session = await insertSession(db, room.id);
  await insertSessionParticipant(db, session.id, reviewer.id, 'interviewer');
  await insertSessionParticipant(db, session.id, candidate.id, 'candidate');
  await insertSessionParticipant(db, session.id, observer.id, 'observer');

  return { reviewer, candidate, observer, room, session };
}

describe('FeedbackService', () => {
  it('GIVEN participant feedback WHEN submitting THEN inserts row and returns reviewer-visible feedback', async () => {
    const { reviewer, candidate, session, room } = await seedPeerSession();

    const result = await service.submitSessionFeedback(
      session.id,
      reviewer.id,
      { ...FEEDBACK_INPUT, candidateId: candidate.id },
      false,
    );

    expect(result.allSubmitted).toBe(false);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      sessionId: session.id,
      roomId: room.id,
      reviewerId: reviewer.id,
      reviewerName: 'Reviewer',
      candidateId: candidate.id,
      candidateName: 'Candidate',
      problemSolvingRating: 4,
      communicationRating: 5,
      codeQualityRating: 4,
      debuggingRating: 3,
      overallRating: 4,
      strengths: 'Explained the approach clearly',
      improvements: 'Call out edge cases earlier',
      wouldPairAgain: true,
    });

    const rows = await db
      .select()
      .from(peerFeedback)
      .where(and(eq(peerFeedback.sessionId, session.id), eq(peerFeedback.reviewerId, reviewer.id)));
    expect(rows).toHaveLength(1);
  });

  it('GIVEN existing reviewer-candidate feedback WHEN submitting again THEN throws conflict', async () => {
    const { reviewer, candidate, session } = await seedPeerSession();
    await service.submitSessionFeedback(
      session.id,
      reviewer.id,
      { ...FEEDBACK_INPUT, candidateId: candidate.id },
      false,
    );

    await expect(
      service.submitSessionFeedback(
        session.id,
        reviewer.id,
        { ...FEEDBACK_INPUT, candidateId: candidate.id },
        false,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('GIVEN reviewer targets themselves WHEN submitting THEN rejects validation', async () => {
    const { reviewer, session } = await seedPeerSession();

    await expect(
      service.submitSessionFeedback(
        session.id,
        reviewer.id,
        { ...FEEDBACK_INPUT, candidateId: reviewer.id },
        false,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('GIVEN non-participant WHEN submitting or reading feedback THEN throws forbidden', async () => {
    const { candidate, session } = await seedPeerSession();
    const stranger = await insertUser(db);

    await expect(
      service.submitSessionFeedback(
        session.id,
        stranger.id,
        { ...FEEDBACK_INPUT, candidateId: candidate.id },
        false,
      ),
    ).rejects.toThrow(ForbiddenException);
    await expect(service.getSessionFeedback(session.id, stranger.id, false)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('GIVEN observer WHEN submitting feedback THEN throws forbidden', async () => {
    const { observer, candidate, session } = await seedPeerSession();

    await expect(
      service.submitSessionFeedback(
        session.id,
        observer.id,
        { ...FEEDBACK_INPUT, candidateId: candidate.id },
        false,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('GIVEN partial submissions WHEN reading feedback THEN hides other reviewers until all expected feedback is submitted', async () => {
    const { reviewer, candidate, observer, session, room } = await seedPeerSession();
    await insertPeerFeedbackRow(db, {
      sessionId: session.id,
      roomId: room.id,
      reviewerId: reviewer.id,
      candidateId: candidate.id,
    });
    await insertPeerFeedbackRow(db, {
      sessionId: session.id,
      roomId: room.id,
      reviewerId: observer.id,
      candidateId: candidate.id,
    });

    const candidateView = await service.getSessionFeedback(session.id, candidate.id, false);
    expect(candidateView.allSubmitted).toBe(false);
    expect(candidateView.data).toHaveLength(0);

    await insertPeerFeedbackRow(db, {
      sessionId: session.id,
      roomId: room.id,
      reviewerId: candidate.id,
      candidateId: reviewer.id,
    });

    const completedView = await service.getSessionFeedback(session.id, candidate.id, false);
    expect(completedView.allSubmitted).toBe(true);
    expect(completedView.data).toHaveLength(2);
  });

  it('GIVEN partial submissions WHEN admin reads feedback THEN returns all existing entries', async () => {
    const { reviewer, candidate, session, room } = await seedPeerSession();
    const admin = await insertUser(db, { role: 'admin' });
    await insertPeerFeedbackRow(db, {
      sessionId: session.id,
      roomId: room.id,
      reviewerId: reviewer.id,
      candidateId: candidate.id,
    });

    const result = await service.getSessionFeedback(session.id, admin.id, true);

    expect(result.allSubmitted).toBe(false);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].reviewerId).toBe(reviewer.id);
  });

  it('GIVEN ongoing session WHEN reading feedback THEN reports session not found', async () => {
    const reviewer = await insertUser(db);
    const room = await insertRoom(db, reviewer.id);
    const session = await insertSession(db, room.id, { status: 'ongoing' });
    await insertSessionParticipant(db, session.id, reviewer.id, 'interviewer');

    await expect(service.getSessionFeedback(session.id, reviewer.id, false)).rejects.toMatchObject({
      response: { code: ERROR_CODES.SESSION_NOT_FOUND },
    });
  });
});
