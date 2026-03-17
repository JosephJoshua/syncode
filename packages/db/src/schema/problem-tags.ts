import { index, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { problems } from './problems';
import { tags } from './tags';

export const problemTags = pgTable(
  'problem_tags',
  {
    problemId: uuid('problem_id')
      .notNull()
      .references(() => problems.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.problemId, table.tagId] }),
    index('problem_tags_tag_id_idx').on(table.tagId),
  ],
);
