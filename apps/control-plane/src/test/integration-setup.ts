import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as schema from '@syncode/db';
import {
  bookmarks,
  type Database,
  problems,
  problemTags,
  roomParticipants,
  rooms,
  submissions,
  tags,
  testCases,
  users,
} from '@syncode/db';
import type { RoomRole } from '@syncode/shared';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { PG_CONFIG_PATH } from './global-setup.js';

interface PgConfig {
  host: string;
  port: number;
  user: string;
  password: string;
}

interface TestDb {
  db: Database;
  cleanup: () => Promise<void>;
}

let pgConfigCache: PgConfig | null = null;

function readPgConfig(): PgConfig {
  if (!pgConfigCache) {
    pgConfigCache = JSON.parse(readFileSync(PG_CONFIG_PATH, 'utf-8')) as PgConfig;
  }
  return pgConfigCache;
}

export async function createTestDb(): Promise<TestDb> {
  const { host, port, user, password } = readPgConfig();

  const dbName = `test_${randomUUID().slice(0, 8)}`;
  const adminUrl = `postgresql://${user}:${password}@${host}:${port}/postgres`;

  const adminClient = postgres(adminUrl, { max: 1 });
  try {
    await adminClient.unsafe(`CREATE DATABASE "${dbName}" TEMPLATE syncode_template`);
  } finally {
    await adminClient.end();
  }

  const testDbUrl = `postgresql://${user}:${password}@${host}:${port}/${dbName}`;
  const client = postgres(testDbUrl);
  const db = drizzle(client, { schema }) as Database;

  return {
    db,
    cleanup: async () => {
      await client.end();
      const dropClient = postgres(adminUrl, { max: 1 });
      try {
        await dropClient.unsafe(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
      } finally {
        await dropClient.end();
      }
    },
  };
}

let seqCounter = 0;

function seq() {
  return ++seqCounter;
}

export async function insertUser(db: Database, overrides?: Partial<typeof users.$inferInsert>) {
  const n = seq();
  const [row] = await db
    .insert(users)
    .values({
      email: `user${n}@test.com`,
      username: `user${n}`,
      passwordHash: 'placeholder',
      displayName: `User ${n}`,
      ...overrides,
    })
    .returning();
  return row;
}

export async function insertRoom(
  db: Database,
  hostId: string,
  overrides?: Partial<typeof rooms.$inferInsert>,
) {
  const n = seq();
  const [row] = await db
    .insert(rooms)
    .values({
      hostId,
      mode: 'peer',
      inviteCode: `T${String(n).padStart(5, '0')}`,
      ...overrides,
    })
    .returning();
  return row;
}

export async function insertParticipant(
  db: Database,
  roomId: string,
  userId: string,
  role: RoomRole = 'host',
) {
  const [row] = await db.insert(roomParticipants).values({ roomId, userId, role }).returning();
  return row;
}

export async function insertProblem(
  db: Database,
  overrides?: Partial<typeof problems.$inferInsert>,
) {
  const n = seq();
  const [row] = await db
    .insert(problems)
    .values({
      title: `Problem ${n}`,
      description: `Description for problem ${n}`,
      difficulty: 'medium',
      ...overrides,
    })
    .returning();
  return row;
}

export async function insertTag(db: Database, overrides?: Partial<typeof tags.$inferInsert>) {
  const n = seq();
  const [row] = await db
    .insert(tags)
    .values({
      name: `Tag ${n}`,
      slug: `tag-${n}`,
      ...overrides,
    })
    .returning();
  return row;
}

export async function insertProblemTag(db: Database, problemId: string, tagId: string) {
  const [row] = await db.insert(problemTags).values({ problemId, tagId }).returning();
  return row;
}

export async function insertBookmark(db: Database, userId: string, problemId: string) {
  const [row] = await db.insert(bookmarks).values({ userId, problemId }).returning();
  return row;
}

export async function insertTestCase(
  db: Database,
  problemId: string,
  overrides?: Partial<typeof testCases.$inferInsert>,
) {
  const n = seq();
  const [row] = await db
    .insert(testCases)
    .values({
      problemId,
      input: `input-${n}`,
      expectedOutput: `output-${n}`,
      ...overrides,
    })
    .returning();
  return row;
}

export async function insertSubmission(
  db: Database,
  userId: string,
  roomId: string,
  problemId: string,
  overrides?: Partial<typeof submissions.$inferInsert>,
) {
  const [row] = await db
    .insert(submissions)
    .values({
      userId,
      roomId,
      problemId,
      code: 'print("hello")',
      language: 'python',
      totalTestCases: 1,
      ...overrides,
    })
    .returning();
  return row;
}
