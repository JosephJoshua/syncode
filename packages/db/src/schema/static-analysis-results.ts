import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  staticAnalysisSourceEnum,
  staticAnalysisStatusEnum,
  supportedLanguageEnum,
} from './enums.js';
import { rooms } from './rooms.js';
import { runs } from './runs.js';
import { sessions } from './sessions.js';
import { submissions } from './submissions.js';
import { users } from './users.js';

export const staticAnalysisResults = pgTable(
  'static_analysis_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: varchar('job_id', { length: 255 }).notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'set null' }),
    runId: uuid('run_id').references(() => runs.id, { onDelete: 'cascade' }),
    submissionId: uuid('submission_id').references(() => submissions.id, { onDelete: 'cascade' }),
    language: supportedLanguageEnum('language').notNull(),
    source: staticAnalysisSourceEnum('source').notNull(),
    status: staticAnalysisStatusEnum('status').notNull().default('pending'),
    diagnosticCount: integer('diagnostic_count').notNull().default(0),
    errorCount: integer('error_count').notNull().default(0),
    warningCount: integer('warning_count').notNull().default(0),
    maxCyclomaticComplexity: integer('max_cyclomatic_complexity'),
    highComplexityCount: integer('high_complexity_count').notNull().default(0),
    duplicationCount: integer('duplication_count').notNull().default(0),
    toolFailureCount: integer('tool_failure_count').notNull().default(0),
    report: jsonb('report'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    index('static_analysis_results_user_id_idx').on(table.userId),
    index('static_analysis_results_room_created_idx').on(table.roomId, table.createdAt),
    index('static_analysis_results_session_id_idx').on(table.sessionId),
    index('static_analysis_results_run_id_idx').on(table.runId),
    index('static_analysis_results_submission_id_idx').on(table.submissionId),
    index('static_analysis_results_status_idx').on(table.status),
    check(
      'static_analysis_results_exactly_one_target_check',
      sql`(((${table.runId} IS NOT NULL)::integer + (${table.submissionId} IS NOT NULL)::integer) = 1)`,
    ),
  ],
);
