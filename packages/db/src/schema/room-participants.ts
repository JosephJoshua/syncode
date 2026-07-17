import { sql } from 'drizzle-orm';
import { boolean, index, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { roomRoleEnum } from './enums.js';
import { rooms } from './rooms.js';
import { users } from './users.js';

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
    isReady: boolean('is_ready').notNull().default(false),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    leftAt: timestamp('left_at', { withTimezone: true }),
    removedAt: timestamp('removed_at', { withTimezone: true }),
    lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('room_participants_room_user_unique').on(table.roomId, table.userId),
    index('room_participants_user_id_idx').on(table.userId),
    index('room_participants_user_active_idx').on(table.userId, table.isActive),
    index('room_participants_active_heartbeat_idx')
      .on(table.lastHeartbeatAt)
      .where(sql`${table.isActive} = true`),
  ],
);
