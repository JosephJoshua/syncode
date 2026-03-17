import { index, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { roleSwapStatusEnum } from './enums';
import { rooms } from './rooms';
import { users } from './users';

export const roleSwapRequests = pgTable(
  'role_swap_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    requesterId: uuid('requester_id')
      .notNull()
      .references(() => users.id),
    targetUserId: uuid('target_user_id')
      .notNull()
      .references(() => users.id),
    status: roleSwapStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('role_swap_requests_room_id_idx').on(table.roomId),
    index('role_swap_requests_requester_id_idx').on(table.requesterId),
    index('role_swap_requests_target_user_id_idx').on(table.targetUserId),
  ],
);
