import { pgTable, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

export const tags = pgTable(
  'tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 50 }).notNull(),
    slug: varchar('slug', { length: 50 }).notNull(),
  },
  (table) => [
    uniqueIndex('tags_name_unique').on(table.name),
    uniqueIndex('tags_slug_unique').on(table.slug),
  ],
);
