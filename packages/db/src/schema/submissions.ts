import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { submissionStatusEnum, supportedLanguageEnum } from './enums.js';
import { problems } from './problems.js';
import { rooms } from './rooms.js';
import { users } from './users.js';

export const submissions = pgTable(
  'submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id),
    problemId: uuid('problem_id')
      .notNull()
      .references(() => problems.id),
    code: text('code').notNull(),
    language: supportedLanguageEnum('language').notNull(),
    status: submissionStatusEnum('status').notNull().default('pending'),
    totalTestCases: integer('total_test_cases').notNull(),
    passedTestCases: integer('passed_test_cases').notNull().default(0),
    failedTestCases: integer('failed_test_cases').notNull().default(0),
    errorTestCases: integer('error_test_cases').notNull().default(0),
    totalDurationMs: integer('total_duration_ms'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    index('submissions_user_id_idx').on(table.userId),
    index('submissions_problem_id_idx').on(table.problemId),
    index('submissions_room_submitted_idx').on(table.roomId, table.submittedAt),
  ],
);
