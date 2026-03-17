import { boolean, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { rooms } from './rooms';
import { users } from './users';

export const recordingConsents = pgTable(
  'recording_consents',
  {
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    consent: boolean('consent').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.roomId, table.userId] })],
);
