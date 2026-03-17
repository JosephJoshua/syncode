import { index, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { sessions } from './sessions';
import { userWeaknesses } from './user-weaknesses';

export const weaknessSessions = pgTable(
  'weakness_sessions',
  {
    weaknessId: uuid('weakness_id')
      .notNull()
      .references(() => userWeaknesses.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.weaknessId, table.sessionId] }),
    index('weakness_sessions_session_id_idx').on(table.sessionId),
  ],
);
