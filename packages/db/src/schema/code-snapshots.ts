import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { snapshotTriggerEnum, supportedLanguageEnum } from './enums.js';
import { rooms } from './rooms.js';
import { sessions } from './sessions.js';

export const codeSnapshots = pgTable(
  'code_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id),
    code: text('code').notNull(),
    language: supportedLanguageEnum('language').notNull(),
    trigger: snapshotTriggerEnum('trigger').notNull(),
    linesOfCode: integer('lines_of_code'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('code_snapshots_room_id_idx').on(table.roomId),
    index('code_snapshots_session_created_idx').on(table.sessionId, table.createdAt),
  ],
);
