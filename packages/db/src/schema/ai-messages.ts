import { index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { aiMessageRoleEnum, difficultyEnum, followUpTypeEnum } from './enums.js';
import { rooms } from './rooms.js';
import { sessions } from './sessions.js';
import { users } from './users.js';

export const aiMessages = pgTable(
  'ai_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id),
    sessionId: uuid('session_id').references(() => sessions.id),
    userId: uuid('user_id').references(() => users.id),
    role: aiMessageRoleEnum('role').notNull(),
    content: text('content').notNull(),
    followUpType: followUpTypeEnum('follow_up_type'),
    difficulty: difficultyEnum('difficulty'),
    audioKey: varchar('audio_key', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ai_messages_session_id_idx').on(table.sessionId),
    index('ai_messages_room_created_idx').on(table.roomId, table.createdAt),
  ],
);
