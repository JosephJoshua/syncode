import {
  boolean,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { roomModeEnum, roomStatusEnum, supportedLanguageEnum } from './enums';
import { timestamps } from './helpers';
import { problems } from './problems';
import { users } from './users';

export const rooms = pgTable(
  'rooms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    hostId: uuid('host_id')
      .notNull()
      .references(() => users.id),
    name: varchar('name', { length: 100 }),
    problemId: uuid('problem_id').references(() => problems.id, { onDelete: 'set null' }),
    language: supportedLanguageEnum('language'),
    mode: roomModeEnum('mode').notNull(),
    status: roomStatusEnum('status').notNull().default('waiting'),
    maxParticipants: integer('max_participants').notNull().default(2),
    maxDuration: integer('max_duration').notNull().default(120),
    inviteCode: varchar('invite_code', { length: 6 }).notNull(),
    isPrivate: boolean('is_private').notNull().default(true),
    editorLocked: boolean('editor_locked').notNull().default(false),
    timerPaused: boolean('timer_paused').notNull().default(false),
    phaseStartedAt: timestamp('phase_started_at', { withTimezone: true }),
    elapsedMs: integer('elapsed_ms').notNull().default(0),
    ...timestamps,
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('rooms_invite_code_unique').on(table.inviteCode),
    index('rooms_host_id_idx').on(table.hostId),
    index('rooms_problem_id_idx').on(table.problemId),
    index('rooms_status_idx').on(table.status),
    index('rooms_created_at_idx').on(table.createdAt),
  ],
);
