import { Test } from '@nestjs/testing';
import type { Database } from '@syncode/db';
import { roomParticipants } from '@syncode/db';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import {
  createTestDb,
  insertParticipant,
  insertRoom,
  insertUser,
} from '@/test/integration-setup.js';
import { ParticipantSweepService } from './participant-sweep.service.js';

let db: Database;
let cleanup: () => Promise<void>;
let service: ParticipantSweepService;

beforeEach(async () => {
  const testDb = await createTestDb();
  db = testDb.db;
  cleanup = testDb.cleanup;

  const module = await Test.createTestingModule({
    providers: [ParticipantSweepService, { provide: DB_CLIENT, useValue: db }],
  }).compile();

  service = module.get(ParticipantSweepService);
});

afterEach(async () => {
  await cleanup();
});

async function setJoinedAndHeartbeat(
  roomId: string,
  userId: string,
  patch: { joinedAt?: Date; lastHeartbeatAt?: Date | null },
) {
  await db
    .update(roomParticipants)
    .set(patch)
    .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userId, userId)));
}

describe('ParticipantSweepService.sweepOnce', () => {
  it('GIVEN participant joined 3m ago AND never heartbeated WHEN sweeping THEN marks inactive with leftAt=now', async () => {
    const host = await insertUser(db);
    const joiner = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, joiner.id, 'candidate');
    await setJoinedAndHeartbeat(room.id, joiner.id, {
      joinedAt: new Date(Date.now() - 3 * 60_000),
      lastHeartbeatAt: null,
    });

    const before = Date.now();
    const swept = await service.sweepOnce();
    const after = Date.now();

    expect(swept).toBe(1);

    const [row] = await db
      .select()
      .from(roomParticipants)
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, joiner.id)));
    expect(row!.isActive).toBe(false);
    expect(row!.leftAt).not.toBeNull();
    const leftTs = row!.leftAt!.getTime();
    expect(leftTs).toBeGreaterThanOrEqual(before);
    expect(leftTs).toBeLessThanOrEqual(after);
  });

  it('GIVEN participant joined 30s ago AND never heartbeated WHEN sweeping THEN does NOT mark inactive', async () => {
    const host = await insertUser(db);
    const joiner = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, joiner.id, 'candidate');
    await setJoinedAndHeartbeat(room.id, joiner.id, {
      joinedAt: new Date(Date.now() - 30_000),
      lastHeartbeatAt: null,
    });

    const swept = await service.sweepOnce();

    expect(swept).toBe(0);

    const [row] = await db
      .select()
      .from(roomParticipants)
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, joiner.id)));
    expect(row!.isActive).toBe(true);
    expect(row!.leftAt).toBeNull();
  });

  it('GIVEN participant with recent heartbeat 30s ago WHEN sweeping THEN does NOT touch', async () => {
    const host = await insertUser(db);
    const joiner = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, joiner.id, 'candidate');
    // joined long ago but heartbeating recently
    await setJoinedAndHeartbeat(room.id, joiner.id, {
      joinedAt: new Date(Date.now() - 10 * 60_000),
      lastHeartbeatAt: new Date(Date.now() - 30_000),
    });

    const swept = await service.sweepOnce();

    expect(swept).toBe(0);

    const [row] = await db
      .select()
      .from(roomParticipants)
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, joiner.id)));
    expect(row!.isActive).toBe(true);
    expect(row!.leftAt).toBeNull();
  });

  it('GIVEN participant with stale heartbeat 3m ago WHEN sweeping THEN marks inactive', async () => {
    const host = await insertUser(db);
    const joiner = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, joiner.id, 'candidate');
    await setJoinedAndHeartbeat(room.id, joiner.id, {
      joinedAt: new Date(Date.now() - 10 * 60_000),
      lastHeartbeatAt: new Date(Date.now() - 3 * 60_000),
    });

    const swept = await service.sweepOnce();

    expect(swept).toBe(1);

    const [row] = await db
      .select()
      .from(roomParticipants)
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, joiner.id)));
    expect(row!.isActive).toBe(false);
    expect(row!.leftAt).not.toBeNull();
  });

  it('GIVEN already inactive participant WHEN sweeping THEN does not re-update', async () => {
    const host = await insertUser(db);
    const joiner = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, joiner.id, 'candidate');
    const originalLeftAt = new Date('2026-04-01T12:00:00Z');
    await db
      .update(roomParticipants)
      .set({
        isActive: false,
        leftAt: originalLeftAt,
        joinedAt: new Date(Date.now() - 10 * 60_000),
        lastHeartbeatAt: null,
      })
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, joiner.id)));

    const swept = await service.sweepOnce();

    expect(swept).toBe(0);

    const [row] = await db
      .select()
      .from(roomParticipants)
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, joiner.id)));
    expect(row!.isActive).toBe(false);
    expect(row!.leftAt).toEqual(originalLeftAt);
  });
});
