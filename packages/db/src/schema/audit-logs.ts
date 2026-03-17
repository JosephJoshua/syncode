import { index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 100 }).notNull(),
    targetType: varchar('target_type', { length: 50 }).notNull(),
    targetId: varchar('target_id', { length: 255 }).notNull(),
    metadata: jsonb('metadata'),
    ipAddress: varchar('ip_address', { length: 45 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_logs_action_idx').on(table.action),
    index('audit_logs_target_idx').on(table.targetType, table.targetId),
    index('audit_logs_created_at_idx').on(table.createdAt),
    index('audit_logs_actor_created_idx').on(table.actorId, table.createdAt),
  ],
);
