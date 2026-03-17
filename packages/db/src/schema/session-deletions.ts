import { index, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sessions } from './sessions';
import { users } from './users';

export const sessionDeletions = pgTable(
  'session_deletions',
  {
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.sessionId, table.userId] }),
    index('session_deletions_user_id_idx').on(table.userId),
  ],
);
