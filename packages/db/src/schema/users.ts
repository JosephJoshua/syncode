import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { userRoleEnum } from './enums';
import { timestamps } from './helpers';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull(),
    username: varchar('username', { length: 50 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    displayName: varchar('display_name', { length: 100 }),
    role: userRoleEnum('role').notNull().default('user'),
    bio: text('bio'),
    avatarUrl: text('avatar_url'),
    bannedAt: timestamp('banned_at', { withTimezone: true }),
    bannedReason: text('banned_reason'),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
    ...timestamps,
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('users_email_unique').on(table.email).where(sql`deleted_at IS NULL`),
    uniqueIndex('users_username_unique').on(table.username).where(sql`deleted_at IS NULL`),
    index('users_role_idx').on(table.role),
    index('users_created_at_idx').on(table.createdAt),
  ],
);
