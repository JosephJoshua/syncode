import {
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { roomModeEnum, sessionStatusEnum, supportedLanguageEnum } from './enums';
import { problems } from './problems';
import { rooms } from './rooms';

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id),
    problemId: uuid('problem_id').references(() => problems.id, { onDelete: 'set null' }),
    mode: roomModeEnum('mode').notNull(),
    language: supportedLanguageEnum('language'),
    status: sessionStatusEnum('status').notNull().default('ongoing'),
    durationMs: integer('duration_ms'),
    whiteboardExportKey: varchar('whiteboard_export_key', { length: 500 }),
    whiteboardCapturedAt: timestamp('whiteboard_captured_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('sessions_room_id_unique').on(table.roomId),
    index('sessions_problem_id_idx').on(table.problemId),
    index('sessions_started_at_idx').on(table.startedAt),
  ],
);
