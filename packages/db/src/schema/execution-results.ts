import { boolean, integer, pgTable, real, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { submissions } from './submissions';

export const executionResults = pgTable(
  'execution_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    submissionId: uuid('submission_id')
      .notNull()
      .references(() => submissions.id, { onDelete: 'cascade' }),
    testCaseIndex: integer('test_case_index').notNull(),
    passed: boolean('passed'),
    stdout: text('stdout'),
    stderr: text('stderr'),
    exitCode: integer('exit_code'),
    expected: text('expected'),
    actual: text('actual'),
    durationMs: integer('duration_ms'),
    memoryUsageMb: real('memory_usage_mb'),
    timedOut: boolean('timed_out').notNull().default(false),
    errorMessage: text('error_message'),
  },
  (table) => [
    uniqueIndex('execution_results_submission_case_unique').on(
      table.submissionId,
      table.testCaseIndex,
    ),
  ],
);
