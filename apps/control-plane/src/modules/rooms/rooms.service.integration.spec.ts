import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { COLLAB_CLIENT, EXECUTION_CLIENT } from '@syncode/contracts';
import type { Database } from '@syncode/db';
import { roomParticipants, rooms, sessionParticipants, sessions } from '@syncode/db';
import { INVITE_CODE_LENGTH } from '@syncode/shared';
import { MEDIA_SERVICE, STORAGE_SERVICE } from '@syncode/shared/ports';
import { and, eq } from 'drizzle-orm';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import {
  createTestDb,
  insertParticipant,
  insertProblem,
  insertRoom,
  insertUser,
} from '@/test/integration-setup.js';
import {
  createMockCollabClient,
  createMockConfigService,
  createMockExecutionClient,
  createMockJwtService,
  createMockMediaService,
  createMockStorageService,
} from '@/test/mock-factories.js';
import { RoomsService } from './rooms.service.js';

let db: Database;
let cleanup: () => Promise<void>;
let service: RoomsService;

beforeEach(async () => {
  vi.clearAllMocks();

  const testDb = await createTestDb();
  db = testDb.db;
  cleanup = testDb.cleanup;

  const module = await Test.createTestingModule({
    providers: [
      RoomsService,
      { provide: DB_CLIENT, useValue: db },
      { provide: EXECUTION_CLIENT, useValue: createMockExecutionClient() },
      { provide: COLLAB_CLIENT, useValue: createMockCollabClient() },
      { provide: MEDIA_SERVICE, useValue: createMockMediaService() },
      { provide: STORAGE_SERVICE, useValue: createMockStorageService() },
      { provide: JwtService, useValue: createMockJwtService() },
      { provide: ConfigService, useValue: createMockConfigService() },
    ],
  }).compile();

  service = module.get(RoomsService);
});

afterEach(async () => {
  await cleanup();
});

describe('createRoom', () => {
  it('GIVEN valid input WHEN creating room THEN persists room with DB defaults and host participant', async () => {
    const user = await insertUser(db);

    const result = await service.createRoom(user.id, {
      mode: 'peer',
      config: { maxParticipants: 2, maxDuration: 120, isPrivate: true },
    });

    expect(result.roomId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(result.status).toBe('waiting');
    expect(result.roomCode).toHaveLength(INVITE_CODE_LENGTH);
    expect(result.hostId).toBe(user.id);
    expect(result.createdAt).toBeInstanceOf(Date);

    const participants = await db
      .select()
      .from(roomParticipants)
      .where(eq(roomParticipants.roomId, result.roomId));
    expect(participants).toHaveLength(1);
    expect(participants[0]).toMatchObject({ userId: user.id, role: 'host' });
  });
});

describe('listRooms', () => {
  it('GIVEN rooms with problems and multiple participants WHEN listing THEN returns correct joins and counts', async () => {
    const user1 = await insertUser(db);
    const user2 = await insertUser(db);
    const problem = await insertProblem(db);

    const roomWithProblem = await insertRoom(db, user1.id, { problemId: problem.id });
    await insertParticipant(db, roomWithProblem.id, user1.id, 'host');
    await insertParticipant(db, roomWithProblem.id, user2.id, 'candidate');

    const roomWithout = await insertRoom(db, user1.id);
    await insertParticipant(db, roomWithout.id, user1.id, 'host');

    const result = await service.listRooms(user1.id, {
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(result.data).toHaveLength(2);

    const withProblem = result.data.find((r) => r.roomId === roomWithProblem.id);
    expect(withProblem).toBeDefined();
    expect(withProblem!.problemTitle).toBe(problem.title);
    expect(withProblem!.participantCount).toBe(2);
    expect(withProblem!.myRole).toBe('host');

    const without = result.data.find((r) => r.roomId === roomWithout.id);
    expect(without).toBeDefined();
    expect(without!.problemTitle).toBeNull();
    expect(without!.participantCount).toBe(1);
  });

  it('GIVEN 5 rooms WHEN paginating with limit=2 THEN traverses all pages without gaps or duplicates', async () => {
    const user = await insertUser(db);
    const roomIds: string[] = [];

    for (let i = 0; i < 5; i++) {
      const room = await insertRoom(db, user.id, {
        createdAt: new Date(`2026-01-0${i + 1}T00:00:00Z`),
      });
      await insertParticipant(db, room.id, user.id, 'host');
      roomIds.push(room.id);
    }

    const query = { limit: 2, sortBy: 'createdAt' as const, sortOrder: 'desc' as const };

    // Page 1
    const page1 = await service.listRooms(user.id, query);
    expect(page1.data).toHaveLength(2);
    expect(page1.pagination.hasMore).toBe(true);
    expect(page1.pagination.nextCursor).not.toBeNull();

    // Page 2
    const page2 = await service.listRooms(user.id, {
      ...query,
      cursor: page1.pagination.nextCursor!,
    });
    expect(page2.data).toHaveLength(2);
    expect(page2.pagination.hasMore).toBe(true);

    // Page 3
    const page3 = await service.listRooms(user.id, {
      ...query,
      cursor: page2.pagination.nextCursor!,
    });
    expect(page3.data).toHaveLength(1);
    expect(page3.pagination.hasMore).toBe(false);
    expect(page3.pagination.nextCursor).toBeNull();

    // No gaps or duplicates
    const allIds = [...page1.data, ...page2.data, ...page3.data].map((r) => r.roomId);
    expect(new Set(allIds).size).toBe(5);
  });

  it('GIVEN rooms with mixed statuses and modes WHEN filtering THEN returns only matching rooms', async () => {
    const user = await insertUser(db);

    const r1 = await insertRoom(db, user.id, { mode: 'peer', status: 'waiting' });
    await insertParticipant(db, r1.id, user.id, 'host');

    const r2 = await insertRoom(db, user.id, { mode: 'peer', status: 'coding' });
    await insertParticipant(db, r2.id, user.id, 'host');

    const r3 = await insertRoom(db, user.id, { mode: 'ai', status: 'waiting' });
    await insertParticipant(db, r3.id, user.id, 'host');

    const base = { limit: 10, sortBy: 'createdAt' as const, sortOrder: 'desc' as const };

    const byStatus = await service.listRooms(user.id, { ...base, status: 'waiting' });
    expect(byStatus.data).toHaveLength(2);

    const byMode = await service.listRooms(user.id, { ...base, mode: 'peer' });
    expect(byMode.data).toHaveLength(2);

    const byBoth = await service.listRooms(user.id, {
      ...base,
      status: 'waiting',
      mode: 'peer',
    });
    expect(byBoth.data).toHaveLength(1);
  });
});

describe('getRoom', () => {
  it('GIVEN room with participants WHEN authorized user requests detail THEN returns full detail with capabilities', async () => {
    const host = await insertUser(db);
    const candidate = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'host');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    const result = await service.getRoom(room.id, host.id);

    expect(result.roomId).toBe(room.id);
    expect(result.participants).toHaveLength(2);
    expect(result.participants.find((p) => p.userId === host.id)?.username).toBe(host.username);
    expect(result.participants.find((p) => p.userId === candidate.id)?.role).toBe('candidate');
    expect(result.myRole).toBe('host');
    expect(result.myCapabilities).toEqual(
      expect.arrayContaining(['code:edit', 'participant:kick', 'room:settings']),
    );
    expect(result.myCapabilities.length).toBeGreaterThan(0);
    expect(result.config).toEqual({
      maxParticipants: room.maxParticipants,
      maxDuration: room.maxDuration,
      isPrivate: room.isPrivate,
    });
  });

  it('GIVEN room exists WHEN non-participant requests detail THEN throws ForbiddenException', async () => {
    const host = await insertUser(db);
    const stranger = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'host');

    await expect(service.getRoom(room.id, stranger.id)).rejects.toThrow(ForbiddenException);
  });
});

describe('joinRoom', () => {
  it('GIVEN valid room code WHEN joining THEN persists participant and returns room detail with collab credentials', async () => {
    const host = await insertUser(db);
    const joiner = await insertUser(db);
    const room = await insertRoom(db, host.id, { maxParticipants: 4 });
    await insertParticipant(db, room.id, host.id, 'host');

    const result = await service.joinRoom(room.id, joiner.id, {
      roomCode: room.inviteCode,
    });

    expect(result.assignedRole).toBe('candidate');
    expect(result.collabToken).toBe('test-collab-token');
    expect(result.collabUrl).toBe('http://localhost:3001');
    expect(result.room.roomId).toBe(room.id);
    expect(result.room.participants).toHaveLength(2);
    expect(result.room.participants.find((p) => p.userId === joiner.id)?.role).toBe('candidate');

    const rows = await db
      .select()
      .from(roomParticipants)
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, joiner.id)));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ role: 'candidate', isActive: true });
  });

  it('GIVEN room at capacity WHEN another user joins THEN throws ConflictException', async () => {
    const host = await insertUser(db);
    const existing = await insertUser(db);
    const joiner = await insertUser(db);
    const room = await insertRoom(db, host.id, { maxParticipants: 2 });
    await insertParticipant(db, room.id, host.id, 'host');
    await insertParticipant(db, room.id, existing.id, 'candidate');

    await expect(
      service.joinRoom(room.id, joiner.id, { roomCode: room.inviteCode }),
    ).rejects.toThrow(ConflictException);
  });

  it('GIVEN user previously left WHEN rejoining THEN reactivates existing row with new role', async () => {
    const host = await insertUser(db);
    const joiner = await insertUser(db);
    const room = await insertRoom(db, host.id, { maxParticipants: 4 });
    await insertParticipant(db, room.id, host.id, 'host');

    const [leftParticipant] = await db
      .insert(roomParticipants)
      .values({ roomId: room.id, userId: joiner.id, role: 'candidate', isActive: false })
      .returning();

    const result = await service.joinRoom(room.id, joiner.id, {
      roomCode: room.inviteCode,
      preferredRole: 'interviewer',
    });

    expect(result.assignedRole).toBe('interviewer');

    const rows = await db
      .select()
      .from(roomParticipants)
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, joiner.id)));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(leftParticipant!.id);
    expect(rows[0]).toMatchObject({ role: 'interviewer', isActive: true });
    expect(rows[0]!.leftAt).toBeNull();
  });

  it('GIVEN non-existent room WHEN joining THEN throws NotFoundException', async () => {
    const joiner = await insertUser(db);

    await expect(
      service.joinRoom('00000000-0000-0000-0000-000000000000', joiner.id, {
        roomCode: 'ABCDEF',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('markParticipantInactive', () => {
  it('GIVEN active participant WHEN marking inactive THEN sets isActive=false and leftAt', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id);
    const joiner = await insertUser(db);
    await insertParticipant(db, room.id, joiner.id, 'candidate');

    const leftAt = new Date('2026-04-08T12:00:00Z');
    await service.markParticipantInactive(room.id, joiner.id, leftAt);

    const [row] = await db
      .select()
      .from(roomParticipants)
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, joiner.id)));

    expect(row!.isActive).toBe(false);
    expect(row!.leftAt).toEqual(leftAt);
  });
});

describe('transitionPhase', () => {
  it('GIVEN room in waiting WHEN host transitions to warmup THEN updates status and creates ongoing session with participants', async () => {
    const host = await insertUser(db);
    const candidate = await insertUser(db);
    const problem = await insertProblem(db);
    const room = await insertRoom(db, host.id, { problemId: problem.id, language: 'python' });
    await insertParticipant(db, room.id, host.id, 'host');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    const result = await service.transitionPhase(room.id, host.id, 'warmup');

    expect(result.previousStatus).toBe('waiting');
    expect(result.currentStatus).toBe('warmup');
    expect(result.transitionedBy).toBe(host.id);
    expect(result.transitionedAt).toBeInstanceOf(Date);

    // Room status updated
    const [updatedRoom] = await db.select().from(rooms).where(eq(rooms.id, room.id));
    expect(updatedRoom!.status).toBe('warmup');
    expect(updatedRoom!.phaseStartedAt).toBeInstanceOf(Date);
    expect(updatedRoom!.endedAt).toBeNull();

    // Session created with ongoing status
    const [session] = await db.select().from(sessions).where(eq(sessions.roomId, room.id));
    expect(session).toBeDefined();
    expect(session!.status).toBe('ongoing');
    expect(session!.problemId).toBe(problem.id);
    expect(session!.mode).toBe('peer');
    expect(session!.language).toBe('python');
    expect(session!.finishedAt).toBeNull();

    // Session participants snapshotted
    const sessionParts = await db
      .select()
      .from(sessionParticipants)
      .where(eq(sessionParticipants.sessionId, session!.id));
    expect(sessionParts).toHaveLength(2);
    expect(sessionParts.map((p) => p.userId).sort()).toEqual([host.id, candidate.id].sort());
  });

  it('GIVEN room in warmup WHEN host transitions to coding THEN updates status without creating duplicate session', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'warmup' });
    await insertParticipant(db, room.id, host.id, 'host');

    const result = await service.transitionPhase(room.id, host.id, 'coding');

    expect(result.previousStatus).toBe('warmup');
    expect(result.currentStatus).toBe('coding');

    // No session created (session was created on waiting→warmup)
    const sessionRows = await db.select().from(sessions).where(eq(sessions.roomId, room.id));
    expect(sessionRows).toHaveLength(0);
  });

  it('GIVEN room in coding with ongoing session WHEN transitioning to finished THEN finalizes session and sets endedAt', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'coding', elapsedMs: 3600000 });
    await insertParticipant(db, room.id, host.id, 'host');

    // Simulate session created during waiting→warmup
    await db.insert(sessions).values({
      roomId: room.id,
      mode: 'peer',
      status: 'ongoing',
    });

    const result = await service.transitionPhase(room.id, host.id, 'finished');

    expect(result.previousStatus).toBe('coding');
    expect(result.currentStatus).toBe('finished');

    // Room ended
    const [updatedRoom] = await db.select().from(rooms).where(eq(rooms.id, room.id));
    expect(updatedRoom!.status).toBe('finished');
    expect(updatedRoom!.endedAt).toBeInstanceOf(Date);

    // Session finalized
    const [session] = await db.select().from(sessions).where(eq(sessions.roomId, room.id));
    expect(session!.status).toBe('finished');
    expect(session!.finishedAt).toBeInstanceOf(Date);
    expect(session!.durationMs).toBe(3600000);
  });

  it('GIVEN room in waiting WHEN transitioning directly to finished THEN no session is created', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'host');

    await service.transitionPhase(room.id, host.id, 'finished');

    const [updatedRoom] = await db.select().from(rooms).where(eq(rooms.id, room.id));
    expect(updatedRoom!.status).toBe('finished');
    expect(updatedRoom!.endedAt).toBeInstanceOf(Date);

    const sessionRows = await db.select().from(sessions).where(eq(sessions.roomId, room.id));
    expect(sessionRows).toHaveLength(0);
  });

  it('GIVEN room in finished WHEN transitioning THEN throws BadRequestException', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'finished' });
    await insertParticipant(db, room.id, host.id, 'host');

    await expect(service.transitionPhase(room.id, host.id, 'coding')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('GIVEN room exists WHEN non-participant transitions THEN throws ForbiddenException', async () => {
    const host = await insertUser(db);
    const stranger = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'host');

    await expect(service.transitionPhase(room.id, stranger.id, 'warmup')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('GIVEN room exists WHEN candidate transitions THEN throws ForbiddenException for missing capability', async () => {
    const host = await insertUser(db);
    const candidate = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'host');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    await expect(service.transitionPhase(room.id, candidate.id, 'warmup')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('GIVEN room in waiting WHEN transitioning to wrapup (invalid skip) THEN throws BadRequestException', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'host');

    await expect(service.transitionPhase(room.id, host.id, 'wrapup')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('GIVEN room in waiting WHEN host transitions directly to coding THEN skips warmup and creates session', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'host');

    const result = await service.transitionPhase(room.id, host.id, 'coding');

    expect(result.previousStatus).toBe('waiting');
    expect(result.currentStatus).toBe('coding');

    const [session] = await db.select().from(sessions).where(eq(sessions.roomId, room.id));
    expect(session).toBeDefined();
    expect(session!.status).toBe('ongoing');
  });

  it('GIVEN interviewer role WHEN transitioning THEN succeeds (has room:change-phase capability)', async () => {
    const host = await insertUser(db);
    const interviewer = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'host');
    await insertParticipant(db, room.id, interviewer.id, 'interviewer');

    const result = await service.transitionPhase(room.id, interviewer.id, 'warmup');

    expect(result.currentStatus).toBe('warmup');
    expect(result.transitionedBy).toBe(interviewer.id);
  });
});
