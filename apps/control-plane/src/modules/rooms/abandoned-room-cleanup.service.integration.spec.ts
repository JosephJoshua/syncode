import { Test } from '@nestjs/testing';
import { COLLAB_CLIENT } from '@syncode/contracts';
import type { Database } from '@syncode/db';
import { matchRequests, roomDocSnapshots, roomParticipants, rooms, sessions } from '@syncode/db';
import { QUEUE_SERVICE } from '@syncode/shared/ports';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import { SessionReportsService } from '@/modules/sessions/session-reports.service.js';
import {
  createTestDb,
  insertParticipant,
  insertRoom,
  insertSession,
  insertUser,
} from '@/test/integration-setup.js';
import { AbandonedRoomCleanupService } from './abandoned-room-cleanup.service.js';

let db: Database;
let cleanup: () => Promise<void>;
let service: AbandonedRoomCleanupService;
let collabClient: {
  createDocument: ReturnType<typeof vi.fn>;
  updateRoomState: ReturnType<typeof vi.fn>;
};
let sessionReportsService: {
  enqueueForFinishedSession: ReturnType<typeof vi.fn>;
};

beforeEach(async () => {
  const testDb = await createTestDb();
  db = testDb.db;
  cleanup = testDb.cleanup;

  const queueService = {
    enqueue: vi.fn().mockResolvedValue('cleanup-job'),
    enqueueBulk: vi.fn().mockResolvedValue([]),
    process: vi.fn(),
    getJob: vi.fn().mockResolvedValue(null),
    getDeadLetterJobs: vi.fn().mockResolvedValue([]),
    retryDeadLetterJob: vi.fn().mockResolvedValue(undefined),
    retryAllDeadLetterJobs: vi.fn().mockResolvedValue(0),
    purgeDeadLetterQueue: vi.fn().mockResolvedValue(0),
    getQueueStats: vi.fn().mockResolvedValue({
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
    }),
    drain: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
    registerEventHandlers: vi.fn(),
  };

  collabClient = {
    createDocument: vi.fn().mockResolvedValue({
      roomId: 'room-id',
      createdAt: Date.now(),
      created: true,
    }),
    updateRoomState: vi.fn().mockResolvedValue({ success: true }),
  };

  sessionReportsService = {
    enqueueForFinishedSession: vi.fn().mockResolvedValue(undefined),
  };

  const module = await Test.createTestingModule({
    providers: [
      AbandonedRoomCleanupService,
      { provide: DB_CLIENT, useValue: db },
      { provide: QUEUE_SERVICE, useValue: queueService },
      { provide: COLLAB_CLIENT, useValue: collabClient },
      { provide: SessionReportsService, useValue: sessionReportsService },
    ],
  }).compile();

  service = module.get(AbandonedRoomCleanupService);
});

afterEach(async () => {
  await cleanup();
});

describe('AbandonedRoomCleanupService.cleanupAbandonedRoomsOnce', () => {
  it('GIVEN waiting room with no active participants for 10+ minutes WHEN cleanup runs THEN marks room as finished', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id, {
      status: 'waiting',
      createdAt: new Date(Date.now() - 60 * 60_000),
    });

    await insertParticipant(db, room.id, host.id, 'interviewer');
    await db
      .update(roomParticipants)
      .set({
        isActive: false,
        isReady: true,
        joinedAt: new Date(Date.now() - 55 * 60_000),
        leftAt: new Date(Date.now() - 30 * 60_000),
      })
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, host.id)));

    const cleaned = await service.cleanupAbandonedRoomsOnce();

    expect(cleaned).toBe(1);

    const [roomRow] = await db.select().from(rooms).where(eq(rooms.id, room.id));
    expect(roomRow?.status).toBe('finished');
    expect(roomRow?.endedAt).not.toBeNull();

    const [participantRow] = await db
      .select({ isReady: roomParticipants.isReady })
      .from(roomParticipants)
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, host.id)));
    expect(participantRow?.isReady).toBe(false);
    expect(sessionReportsService.enqueueForFinishedSession).not.toHaveBeenCalled();
    expect(collabClient.updateRoomState).not.toHaveBeenCalled();
  });

  it('GIVEN coding room with no active participants for 10+ minutes WHEN cleanup runs THEN finishes session and enqueues reports', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id, {
      status: 'coding',
      language: 'python',
      elapsedMs: 30_000,
      timerPaused: false,
      createdAt: new Date(Date.now() - 60 * 60_000),
      phaseStartedAt: new Date(Date.now() - 15 * 60_000),
    });

    await insertParticipant(db, room.id, host.id, 'interviewer');
    await db
      .update(roomParticipants)
      .set({
        isActive: false,
        joinedAt: new Date(Date.now() - 55 * 60_000),
        leftAt: new Date(Date.now() - 30 * 60_000),
      })
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, host.id)));

    const session = await insertSession(db, room.id, {
      status: 'ongoing',
      mode: room.mode,
      language: room.language,
      startedAt: new Date(Date.now() - 30 * 60_000),
      finishedAt: null,
      durationMs: null,
    });

    const cleaned = await service.cleanupAbandonedRoomsOnce();

    expect(cleaned).toBe(1);

    const [roomRow] = await db.select().from(rooms).where(eq(rooms.id, room.id));
    expect(roomRow?.status).toBe('finished');
    expect(roomRow?.endedAt).not.toBeNull();
    expect(roomRow?.elapsedMs ?? 0).toBeGreaterThan(30_000);

    const [sessionRow] = await db.select().from(sessions).where(eq(sessions.id, session.id));
    expect(sessionRow?.status).toBe('finished');
    expect(sessionRow?.finishedAt).not.toBeNull();
    expect(sessionRow?.durationMs ?? 0).toBeGreaterThan(30_000);

    expect(collabClient.updateRoomState).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: room.id,
        phase: 'finished',
        language: 'python',
      }),
    );
    expect(sessionReportsService.enqueueForFinishedSession).toHaveBeenCalledWith(session.id);
  });

  it('GIVEN collab room missing WHEN cleanup runs THEN recreates collab doc and still finishes room', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id, {
      status: 'wrapup',
      language: 'python',
      elapsedMs: 30_000,
      timerPaused: false,
      createdAt: new Date(Date.now() - 60 * 60_000),
      phaseStartedAt: new Date(Date.now() - 20 * 60_000),
    });

    await insertParticipant(db, room.id, host.id, 'interviewer');
    await db
      .update(roomParticipants)
      .set({
        isActive: false,
        joinedAt: new Date(Date.now() - 55 * 60_000),
        leftAt: new Date(Date.now() - 30 * 60_000),
      })
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, host.id)));

    const session = await insertSession(db, room.id, {
      status: 'ongoing',
      mode: room.mode,
      language: room.language,
      startedAt: new Date(Date.now() - 30 * 60_000),
      finishedAt: null,
      durationMs: null,
    });

    await db.insert(roomDocSnapshots).values({
      roomId: room.id,
      state: new Uint8Array([1, 2, 3]),
      updatedAt: new Date(),
    });

    const notFoundError = Object.assign(new Error('Room not found'), {
      response: { status: 404 },
    });
    collabClient.updateRoomState
      .mockRejectedValueOnce(notFoundError)
      .mockResolvedValueOnce({ success: true });

    const cleaned = await service.cleanupAbandonedRoomsOnce();

    expect(cleaned).toBe(1);
    expect(collabClient.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: room.id,
        initialPhase: 'wrapup',
        initialLanguage: 'python',
        snapshot: [1, 2, 3],
      }),
    );
    expect(collabClient.updateRoomState).toHaveBeenCalledTimes(2);

    const [roomRow] = await db.select().from(rooms).where(eq(rooms.id, room.id));
    expect(roomRow?.status).toBe('finished');
    expect(roomRow?.endedAt).not.toBeNull();

    const [sessionRow] = await db.select().from(sessions).where(eq(sessions.id, session.id));
    expect(sessionRow?.status).toBe('finished');
    expect(sessionReportsService.enqueueForFinishedSession).toHaveBeenCalledWith(session.id);
  });

  it('GIVEN collab update fails WHEN cleanup runs THEN leaves room unfinished and skips reports', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id, {
      status: 'coding',
      language: 'python',
      elapsedMs: 30_000,
      timerPaused: false,
      createdAt: new Date(Date.now() - 60 * 60_000),
      phaseStartedAt: new Date(Date.now() - 15 * 60_000),
    });

    await insertParticipant(db, room.id, host.id, 'interviewer');
    await db
      .update(roomParticipants)
      .set({
        isActive: false,
        joinedAt: new Date(Date.now() - 55 * 60_000),
        leftAt: new Date(Date.now() - 30 * 60_000),
      })
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, host.id)));

    const session = await insertSession(db, room.id, {
      status: 'ongoing',
      mode: room.mode,
      language: room.language,
      startedAt: new Date(Date.now() - 30 * 60_000),
      finishedAt: null,
      durationMs: null,
    });

    collabClient.updateRoomState.mockRejectedValueOnce(new Error('connection refused'));

    const cleaned = await service.cleanupAbandonedRoomsOnce();

    expect(cleaned).toBe(0);
    expect(collabClient.createDocument).not.toHaveBeenCalled();

    const [roomRow] = await db.select().from(rooms).where(eq(rooms.id, room.id));
    expect(roomRow?.status).toBe('coding');

    const [sessionRow] = await db.select().from(sessions).where(eq(sessions.id, session.id));
    expect(sessionRow?.status).toBe('ongoing');
    expect(sessionReportsService.enqueueForFinishedSession).not.toHaveBeenCalled();
  });

  it('GIVEN abandoned matched room WHEN cleanup runs THEN expires linked matchmaking requests', async () => {
    const host = await insertUser(db);
    const matchedUser = await insertUser(db);
    const room = await insertRoom(db, host.id, {
      status: 'waiting',
      createdAt: new Date(Date.now() - 60 * 60_000),
    });

    await insertParticipant(db, room.id, host.id, 'interviewer');
    await db
      .update(roomParticipants)
      .set({
        isActive: false,
        joinedAt: new Date(Date.now() - 55 * 60_000),
        leftAt: new Date(Date.now() - 30 * 60_000),
      })
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, host.id)));

    const [request] = await db
      .insert(matchRequests)
      .values({
        userId: matchedUser.id,
        status: 'matched',
        matchedRoomId: room.id,
        matchedWithUserId: host.id,
        expiresAt: new Date(Date.now() + 60_000),
      })
      .returning({ id: matchRequests.id });
    if (!request) {
      throw new Error('expected match request');
    }

    const cleaned = await service.cleanupAbandonedRoomsOnce();

    expect(cleaned).toBe(1);

    const [requestRow] = await db
      .select({ status: matchRequests.status })
      .from(matchRequests)
      .where(eq(matchRequests.id, request.id));
    expect(requestRow?.status).toBe('expired');
  });

  it('GIVEN waiting room with active participant WHEN cleanup runs THEN does not finish room', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id, {
      status: 'waiting',
      createdAt: new Date(Date.now() - 60 * 60_000),
    });
    await insertParticipant(db, room.id, host.id, 'interviewer');

    const cleaned = await service.cleanupAbandonedRoomsOnce();

    expect(cleaned).toBe(0);

    const [roomRow] = await db.select().from(rooms).where(eq(rooms.id, room.id));
    expect(roomRow?.status).toBe('waiting');
    expect(roomRow?.endedAt).toBeNull();
  });

  it('GIVEN abandoned room less than threshold WHEN cleanup runs THEN does not finish room', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id, {
      status: 'waiting',
      createdAt: new Date(Date.now() - 30 * 60_000),
    });

    await insertParticipant(db, room.id, host.id, 'interviewer');
    await db
      .update(roomParticipants)
      .set({
        isActive: false,
        joinedAt: new Date(Date.now() - 25 * 60_000),
        leftAt: new Date(Date.now() - 5 * 60_000),
      })
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, host.id)));

    const cleaned = await service.cleanupAbandonedRoomsOnce();

    expect(cleaned).toBe(0);

    const [roomRow] = await db.select().from(rooms).where(eq(rooms.id, room.id));
    expect(roomRow?.status).toBe('waiting');
    expect(roomRow?.endedAt).toBeNull();
  });
});
