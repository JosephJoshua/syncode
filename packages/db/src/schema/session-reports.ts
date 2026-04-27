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
import { sessionReportStatusEnum } from './enums.js';
import { sessions } from './sessions.js';
import { users } from './users.js';

export const sessionReports = pgTable(
  'session_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: sessionReportStatusEnum('status').notNull().default('pending'),
    overallScore: integer('overall_score'),
    report: jsonb('report'),
    model: varchar('model', { length: 120 }),
    errorMessage: text('error_message'),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    generatedAt: timestamp('generated_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('session_reports_session_user_unique').on(table.sessionId, table.userId),
    index('session_reports_session_id_idx').on(table.sessionId),
    index('session_reports_user_id_idx').on(table.userId),
    index('session_reports_status_idx').on(table.status),
  ],
);
