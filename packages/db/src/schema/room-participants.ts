import { boolean, index, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { roomRoleEnum } from './enums';
import { rooms } from './rooms';
import { users } from './users';

export const roomParticipants = pgTable(
  'room_participants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    role: roomRoleEnum('role').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    leftAt: timestamp('left_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('room_participants_room_user_unique').on(table.roomId, table.userId),
    index('room_participants_user_id_idx').on(table.userId),
    index('room_participants_user_active_idx').on(table.userId, table.isActive),
  ],
);
