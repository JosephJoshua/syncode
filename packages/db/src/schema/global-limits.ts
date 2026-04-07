import { integer, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';

export const globalLimits = pgTable('global_limits', {
  key: varchar('key', { length: 64 }).primaryKey(),
  value: integer('value').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const GLOBAL_LIMIT_KEYS = {
  AI_DAILY: 'ai_daily_limit',
  EXECUTION_DAILY: 'execution_daily_limit',
  ROOMS_MAX_ACTIVE: 'rooms_max_active',
} as const;

export type GlobalLimitKey = (typeof GLOBAL_LIMIT_KEYS)[keyof typeof GLOBAL_LIMIT_KEYS];
