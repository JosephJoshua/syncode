import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ERROR_CODES } from '@syncode/contracts';
import type { Database } from '@syncode/db';
import { peerFeedback } from '@syncode/db';
import { STORAGE_SERVICE } from '@syncode/shared/ports';
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
import { createMockStorageService } from '@/test/mock-factories.js';
import { FeedbackService } from './feedback.service.js';

let db: Database;
let cleanup: () => Promise<void>;
let service: FeedbackService;

const FEEDBACK_INPUT = {
  candidateId: '',
  feedbackText: 'Explained trade-offs clearly.\n\nCould mention edge cases earlier.',
};

beforeEach(async () => {
  const testDb = await createTestDb();
  db = testDb.db;
  cleanup = testDb.cleanup;

  const module = await Test.createTestingModule({
    providers: [
      FeedbackService,
      { provide: DB_CLIENT, useValue: db },
      { provide: STORAGE_SERVICE, useValue: createMockStorageService() },
    ],
  }).compile();

  service = module.get(FeedbackService);
});

afterEach(async () => {
  await cleanup();
});

async function seedPeerSession() {
  const reviewer = await insertUser(db, { displayName: 'Reviewer' });
  const candidate = await insertUser(db, { displayName: 'Candidate' });
  const interviewer = await insertUser(db, { displayName: 'Interviewer' });
  const observer = await insertUser(db, { displayName: 'Observer' });
  const room = await insertRoom(db, reviewer.id, { mode: 'peer' });
  const session = await insertSession(db, room.id, { mode: 'peer' });
  await insertSessionParticipant(db, session.id, reviewer.id, 'interviewer');
  await insertSessionParticipant(db, session.id, candidate.id, 'candidate');
  await insertSessionParticipant(db, session.id, interviewer.id, 'interviewer');
  await insertSessionParticipant(db, session.id, observer.id, 'observer');

  return { reviewer, candidate, interviewer, observer, room, session };
}

describe('FeedbackService', () => {
  it('GIVEN text feedback WHEN submitting THEN inserts a submitted row and returns reviewer-visible feedback', async () => {
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
      status: 'submitted',
      reviewerId: reviewer.id,
      reviewerName: 'Reviewer',
      candidateId: candidate.id,
      candidateName: 'Candidate',
      feedbackText: FEEDBACK_INPUT.feedbackText,
    });

    const rows = await db
      .select()
      .from(peerFeedback)
      .where(and(eq(peerFeedback.sessionId, session.id), eq(peerFeedback.reviewerId, reviewer.id)));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('submitted');
    expect(rows[0]?.feedbackText).toBe(FEEDBACK_INPUT.feedbackText);
  });

  it('GIVEN reviewer skips a target WHEN reading progress THEN marks that target as skipped', async () => {
    const { reviewer, candidate, session } = await seedPeerSession();

    const progress = await service.skipSessionFeedback(session.id, reviewer.id, {
      candidateId: candidate.id,
    });

    expect(progress.allSubmitted).toBe(false);
    expect(progress.targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          candidateId: candidate.id,
          state: 'skipped',
        }),
      ]),
    );
  });

  it('GIVEN reviewer skips all remaining targets WHEN reading progress THEN all targets are resolved', async () => {
    const { reviewer, candidate, interviewer, session } = await seedPeerSession();

    const progress = await service.skipAllSessionFeedback(session.id, reviewer.id);

    expect(progress.allSubmitted).toBe(true);
    expect(progress.targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ candidateId: candidate.id, state: 'skipped' }),
        expect.objectContaining({ candidateId: interviewer.id, state: 'skipped' }),
      ]),
    );
  });

  it('GIVEN observer WHEN requesting progress THEN returns no targets and no modal work', async () => {
    const { observer, session } = await seedPeerSession();

    const progress = await service.getSessionFeedbackProgress(session.id, observer.id);

    expect(progress.allSubmitted).toBe(true);
    expect(progress.targets).toHaveLength(0);
  });

  it('GIVEN partial reviewer submissions WHEN reading feedback THEN hides other reviewers until all pairs are resolved', async () => {
    const { reviewer, candidate, interviewer, session, room } = await seedPeerSession();
    await insertPeerFeedbackRow(db, {
      sessionId: session.id,
      roomId: room.id,
      reviewerId: reviewer.id,
      candidateId: candidate.id,
    });

    const reviewerView = await service.getSessionFeedback(session.id, reviewer.id, false);
    expect(reviewerView.allSubmitted).toBe(false);
    expect(reviewerView.data).toHaveLength(1);

    const candidateView = await service.getSessionFeedback(session.id, candidate.id, false);
    expect(candidateView.allSubmitted).toBe(false);
    expect(candidateView.data).toHaveLength(0);

    await service.skipSessionFeedback(session.id, reviewer.id, { candidateId: interviewer.id });
    await service.skipAllSessionFeedback(session.id, candidate.id);
    await service.skipAllSessionFeedback(session.id, interviewer.id);

    const resolvedView = await service.getSessionFeedback(session.id, candidate.id, false);
    expect(resolvedView.allSubmitted).toBe(true);
    expect(resolvedView.data).toHaveLength(1);
  });

  it('GIVEN only one review participant WHEN reading feedback THEN treats the session as fully resolved', async () => {
    const reviewer = await insertUser(db, { displayName: 'Reviewer' });
    const observer = await insertUser(db, { displayName: 'Observer' });
    const room = await insertRoom(db, reviewer.id, { mode: 'peer' });
    const session = await insertSession(db, room.id, { mode: 'peer' });
    await insertSessionParticipant(db, session.id, reviewer.id, 'interviewer');
    await insertSessionParticipant(db, session.id, observer.id, 'observer');

    const result = await service.getSessionFeedback(session.id, reviewer.id, false);

    expect(result).toEqual({ allSubmitted: true, data: [] });
  });

  it('GIVEN existing legacy feedback row WHEN reading feedback THEN derives feedback text from strengths and improvements', async () => {
    const { reviewer, candidate, session, room } = await seedPeerSession();
    await insertPeerFeedbackRow(
      db,
      {
        sessionId: session.id,
        roomId: room.id,
        reviewerId: reviewer.id,
        candidateId: candidate.id,
      },
      {
        feedbackText: null,
        strengths: 'Strong explanation',
        improvements: 'Add more edge cases',
      },
    );

    const result = await service.getSessionFeedback(session.id, reviewer.id, true);

    expect(result.data[0]?.feedbackText).toBe('Strong explanation\n\nAdd more edge cases');
  });

  it('GIVEN reviewer targets themselves WHEN submitting or skipping THEN rejects validation', async () => {
    const { reviewer, session } = await seedPeerSession();

    await expect(
      service.submitSessionFeedback(
        session.id,
        reviewer.id,
        { ...FEEDBACK_INPUT, candidateId: reviewer.id },
        false,
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.skipSessionFeedback(session.id, reviewer.id, { candidateId: reviewer.id }),
    ).rejects.toThrow(BadRequestException);
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

  it('GIVEN ai session WHEN reading feedback THEN returns an empty resolved result', async () => {
    const reviewer = await insertUser(db, { displayName: 'Reviewer' });
    const room = await insertRoom(db, reviewer.id, { mode: 'ai' });
    const session = await insertSession(db, room.id, { mode: 'ai' });
    await insertSessionParticipant(db, session.id, reviewer.id, 'candidate');

    const result = await service.getSessionFeedback(session.id, reviewer.id, false);

    expect(result).toEqual({ allSubmitted: true, data: [] });
  });

  it('GIVEN ongoing session WHEN reading feedback THEN reports session not found', async () => {
    const reviewer = await insertUser(db);
    const room = await insertRoom(db, reviewer.id, { mode: 'peer' });
    const session = await insertSession(db, room.id, { status: 'ongoing', mode: 'peer' });
    await insertSessionParticipant(db, session.id, reviewer.id, 'interviewer');

    await expect(service.getSessionFeedback(session.id, reviewer.id, false)).rejects.toMatchObject({
      response: { code: ERROR_CODES.SESSION_NOT_FOUND },
    });
  });
});
