import { boolean, index, integer, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { problems } from './problems';

export const testCases = pgTable(
  'test_cases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    problemId: uuid('problem_id')
      .notNull()
      .references(() => problems.id, { onDelete: 'cascade' }),
    input: text('input').notNull(),
    expectedOutput: text('expected_output').notNull(),
    description: varchar('description', { length: 255 }),
    isHidden: boolean('is_hidden').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    timeoutMs: integer('timeout_ms'),
    memoryMb: integer('memory_mb'),
  },
  (table) => [index('test_cases_problem_sort_idx').on(table.problemId, table.sortOrder)],
);
