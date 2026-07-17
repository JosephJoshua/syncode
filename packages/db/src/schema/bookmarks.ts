import { index, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { problems } from './problems.js';
import { users } from './users.js';

export const bookmarks = pgTable(
  'bookmarks',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    problemId: uuid('problem_id')
      .notNull()
      .references(() => problems.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.problemId] }),
    index('bookmarks_problem_id_idx').on(table.problemId),
  ],
);
