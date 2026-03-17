import { index, integer, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';

export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    key: varchar('key', { length: 255 }).primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    responseBody: jsonb('response_body'),
    statusCode: integer('status_code').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('idempotency_keys_user_id_idx').on(table.userId),
    index('idempotency_keys_expires_at_idx').on(table.expiresAt),
  ],
);
