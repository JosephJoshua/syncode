import {
  boolean,
  index,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { submissionStatusEnum, supportedLanguageEnum } from './enums';
import { rooms } from './rooms';
import { users } from './users';

export const runs = pgTable(
  'runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id),
    jobId: varchar('job_id', { length: 255 }).notNull(),
    code: text('code').notNull(),
    language: supportedLanguageEnum('language').notNull(),
    stdin: text('stdin'),
    status: submissionStatusEnum('status').notNull().default('pending'),
    stdout: text('stdout'),
    stderr: text('stderr'),
    exitCode: integer('exit_code'),
    durationMs: integer('duration_ms'),
    cpuTimeMs: integer('cpu_time_ms'),
    memoryUsageMb: real('memory_usage_mb'),
    timedOut: boolean('timed_out').notNull().default(false),
    outputTruncated: boolean('output_truncated').notNull().default(false),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    index('runs_user_id_idx').on(table.userId),
    index('runs_room_created_idx').on(table.roomId, table.createdAt),
    index('runs_job_id_idx').on(table.jobId),
  ],
);
