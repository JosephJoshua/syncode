import { bigint, index, integer, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { sessions } from './sessions';

export const sessionRecordings = pgTable(
  'session_recordings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    storageKey: varchar('storage_key', { length: 500 }).notNull(),
    durationMs: integer('duration_ms'),
    format: varchar('format', { length: 50 }),
    sizeBytes: bigint('size_bytes', { mode: 'number' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    stoppedAt: timestamp('stopped_at', { withTimezone: true }),
  },
  (table) => [index('session_recordings_session_id_idx').on(table.sessionId)],
);
