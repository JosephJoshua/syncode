import { index, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { roomRoleEnum } from './enums';
import { sessions } from './sessions';
import { users } from './users';

export const sessionParticipants = pgTable(
  'session_participants',
  {
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    role: roomRoleEnum('role').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    leftAt: timestamp('left_at', { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.sessionId, table.userId] }),
    index('session_participants_user_id_idx').on(table.userId),
  ],
);
