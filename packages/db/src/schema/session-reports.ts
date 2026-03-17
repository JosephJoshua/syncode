import { integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sessions } from './sessions';

export const sessionReports = pgTable(
  'session_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    overallScore: integer('overall_score').notNull(),
    categoryScores: jsonb('category_scores').notNull(),
    strengths: jsonb('strengths'),
    areasForImprovement: jsonb('areas_for_improvement'),
    feedback: text('feedback').notNull(),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('session_reports_session_id_unique').on(table.sessionId)],
);
