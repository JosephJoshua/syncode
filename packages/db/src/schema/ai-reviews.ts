import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { rooms } from './rooms';
import { users } from './users';

export const aiReviews = pgTable(
  'ai_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    overallScore: integer('overall_score').notNull(),
    categories: jsonb('categories').notNull(),
    suggestions: jsonb('suggestions').notNull(),
    summary: text('summary').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ai_reviews_room_id_idx').on(table.roomId),
    index('ai_reviews_user_id_idx').on(table.userId),
  ],
);
