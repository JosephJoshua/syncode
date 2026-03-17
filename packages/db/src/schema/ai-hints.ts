import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { hintLevelEnum } from './enums';
import { rooms } from './rooms';
import { users } from './users';

export const aiHints = pgTable(
  'ai_hints',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    hint: text('hint').notNull(),
    hintLevel: hintLevelEnum('hint_level').notNull(),
    relatedConcepts: text('related_concepts').array(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ai_hints_room_id_idx').on(table.roomId),
    index('ai_hints_user_id_idx').on(table.userId),
  ],
);
