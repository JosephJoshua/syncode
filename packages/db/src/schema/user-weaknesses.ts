import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { weaknessCategoryEnum, weaknessTrendEnum } from './enums.js';
import { users } from './users.js';

export const userWeaknesses = pgTable(
  'user_weaknesses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    category: weaknessCategoryEnum('category').notNull(),
    description: text('description').notNull(),
    frequency: integer('frequency').notNull().default(1),
    trend: weaknessTrendEnum('trend').notNull().default('stable'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('user_weaknesses_user_category_unique').on(table.userId, table.category),
    index('user_weaknesses_user_frequency_idx').on(table.userId, table.frequency),
  ],
);
