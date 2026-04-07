import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { difficultyEnum } from './enums.js';
import { timestamps } from './helpers.js';

export const problems = pgTable(
  'problems',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description').notNull(),
    difficulty: difficultyEnum('difficulty').notNull(),
    company: varchar('company', { length: 100 }),
    constraints: text('constraints'),
    examples: jsonb('examples'),
    starterCode: jsonb('starter_code'),
    timeLimit: integer('time_limit'),
    memoryLimit: integer('memory_limit'),
    totalSubmissions: integer('total_submissions').notNull().default(0),
    acceptedSubmissions: integer('accepted_submissions').notNull().default(0),
    ...timestamps,
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('problems_title_unique').on(table.title).where(sql`deleted_at IS NULL`),
    index('problems_difficulty_idx').on(table.difficulty),
    index('problems_title_trgm_idx').using('gin', sql`title gin_trgm_ops`),
    index('problems_description_trgm_idx').using('gin', sql`description gin_trgm_ops`),
    index('problems_created_at_idx').on(table.createdAt),
  ],
);
