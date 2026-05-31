import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { rooms } from './rooms.js';
import { sessions } from './sessions.js';
import { users } from './users.js';

const FEEDBACK_STATUSES = ['submitted', 'skipped'] as const;

export const peerFeedback = pgTable(
  'peer_feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'set null' }),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id),
    reviewerId: uuid('reviewer_id')
      .notNull()
      .references(() => users.id),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => users.id),
    status: text('status', { enum: FEEDBACK_STATUSES }).notNull().default('submitted'),
    feedbackText: text('feedback_text'),
    problemSolvingRating: integer('problem_solving_rating'),
    communicationRating: integer('communication_rating'),
    codeQualityRating: integer('code_quality_rating'),
    debuggingRating: integer('debugging_rating'),
    overallRating: integer('overall_rating'),
    strengths: text('strengths'),
    improvements: text('improvements'),
    wouldPairAgain: boolean('would_pair_again'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('peer_feedback_room_reviewer_candidate_unique').on(
      table.roomId,
      table.reviewerId,
      table.candidateId,
    ),
    index('peer_feedback_session_id_idx').on(table.sessionId),
    index('peer_feedback_reviewer_id_idx').on(table.reviewerId),
    index('peer_feedback_candidate_id_idx').on(table.candidateId),
  ],
);
