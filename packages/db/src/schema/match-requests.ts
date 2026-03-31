import { index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { difficultyEnum, matchStatusEnum, supportedLanguageEnum } from './enums.js';
import { rooms } from './rooms.js';
import { users } from './users.js';

export const matchRequests = pgTable(
  'match_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    difficulty: difficultyEnum('difficulty'),
    language: supportedLanguageEnum('language'),
    preferredRole: varchar('preferred_role', { length: 20 }),
    preferredTags: jsonb('preferred_tags'),
    status: matchStatusEnum('status').notNull().default('pending'),
    matchedRoomId: uuid('matched_room_id').references(() => rooms.id),
    matchedWithUserId: uuid('matched_with_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('match_requests_user_id_idx').on(table.userId),
    index('match_requests_status_idx').on(table.status),
    index('match_requests_expires_at_idx').on(table.expiresAt),
  ],
);
