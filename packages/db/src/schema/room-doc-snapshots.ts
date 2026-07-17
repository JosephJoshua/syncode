import { customType, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { rooms } from './rooms.js';

const bytea = customType<{ data: Uint8Array; notNull: true; default: false }>({
  dataType() {
    return 'bytea';
  },
  toDriver(value: Uint8Array) {
    return Buffer.from(value);
  },
  fromDriver(value: unknown): Uint8Array {
    if (value instanceof Uint8Array) return value;
    if (Buffer.isBuffer(value)) return new Uint8Array(value);
    throw new Error(`Unexpected bytea driver value: ${typeof value}`);
  },
});

export const roomDocSnapshots = pgTable('room_doc_snapshots', {
  roomId: uuid('room_id')
    .primaryKey()
    .references(() => rooms.id, { onDelete: 'cascade' }),
  state: bytea('state').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
