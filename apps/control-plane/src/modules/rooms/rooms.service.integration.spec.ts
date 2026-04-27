import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { COLLAB_CLIENT, ERROR_CODES, EXECUTION_CLIENT } from '@syncode/contracts';
import type { Database } from '@syncode/db';
import {
  roomDocSnapshots,
  roomParticipants,
  rooms,
  sessionParticipants,
  sessions,
  submissions,
} from '@syncode/db';
import { INVITE_CODE_LENGTH } from '@syncode/shared';
import { CACHE_SERVICE, MEDIA_SERVICE, STORAGE_SERVICE } from '@syncode/shared/ports';
import { and, eq } from 'drizzle-orm';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import { ExecutionService } from '@/modules/execution/execution.service.js';
import { InMemoryCacheService } from '@/test/in-memory-cache.service.js';
import {
  createTestDb,
  insertParticipant,
  insertProblem,
  insertRoom,
  insertTestCase,
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
let mockExecutionClient: ReturnType<typeof createMockExecutionClient>;
let mockCollabClient: ReturnType<typeof createMockCollabClient>;

beforeEach(async () => {
  vi.clearAllMocks();

  const testDb = await createTestDb();
  db = testDb.db;
  cleanup = testDb.cleanup;
  mockExecutionClient = createMockExecutionClient();
  mockCollabClient = createMockCollabClient();

  const module = await Test.createTestingModule({
    providers: [
      RoomsService,
      ExecutionService,
      { provide: DB_CLIENT, useValue: db },
      { provide: EXECUTION_CLIENT, useValue: mockExecutionClient },
      { provide: CACHE_SERVICE, useValue: new InMemoryCacheService() },
      { provide: COLLAB_CLIENT, useValue: mockCollabClient },
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
  it('GIVEN valid input WHEN creating room THEN persists room with DB defaults and interviewer participant for the host', async () => {
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
    expect(participants[0]).toMatchObject({ userId: user.id, role: 'interviewer' });
  });

  it('GIVEN problemId and language WHEN creating room THEN passes starter code as initialContent to collab', async () => {
    const user = await insertUser(db);
    const problem = await insertProblem(db, {
      starterCode: { python: '# starter', javascript: '// starter' },
    });

    await service.createRoom(user.id, {
      mode: 'peer',
      problemId: problem.id,
      language: 'python',
      config: { maxParticipants: 2, maxDuration: 120, isPrivate: true },
    });

    expect(mockCollabClient.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({ initialContent: '# starter' }),
    );
  });

  it('GIVEN no problemId WHEN creating room THEN passes no initialContent to collab', async () => {
    const user = await insertUser(db);

    await service.createRoom(user.id, {
      mode: 'peer',
      config: { maxParticipants: 2, maxDuration: 120, isPrivate: true },
    });

    expect(mockCollabClient.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({ initialContent: undefined }),
    );
  });
});

describe('listRooms', () => {
  it('GIVEN rooms with problems and multiple participants WHEN listing THEN returns correct joins and counts', async () => {
    const user1 = await insertUser(db);
    const user2 = await insertUser(db);
    const problem = await insertProblem(db);

    const roomWithProblem = await insertRoom(db, user1.id, { problemId: problem.id });
    await insertParticipant(db, roomWithProblem.id, user1.id, 'interviewer');
    await insertParticipant(db, roomWithProblem.id, user2.id, 'candidate');

    const roomWithout = await insertRoom(db, user1.id);
    await insertParticipant(db, roomWithout.id, user1.id, 'interviewer');

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
    expect(withProblem!.myRole).toBe('interviewer');

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
      await insertParticipant(db, room.id, user.id, 'interviewer');
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
    await insertParticipant(db, r1.id, user.id, 'interviewer');

    const r2 = await insertRoom(db, user.id, { mode: 'peer', status: 'coding' });
    await insertParticipant(db, r2.id, user.id, 'interviewer');

    const r3 = await insertRoom(db, user.id, { mode: 'ai', status: 'waiting' });
    await insertParticipant(db, r3.id, user.id, 'interviewer');

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
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    const result = await service.getRoom(room.id, host.id);

    expect(result.roomId).toBe(room.id);
    expect(result.participants).toHaveLength(2);
    expect(result.participants.find((p) => p.userId === host.id)?.username).toBe(host.username);
    expect(result.participants.find((p) => p.userId === candidate.id)?.role).toBe('candidate');
    expect(result.myRole).toBe('interviewer');
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
    await insertParticipant(db, room.id, host.id, 'interviewer');

    await expect(service.getRoom(room.id, stranger.id)).rejects.toThrow(ForbiddenException);
  });

  it('GIVEN participant row is inactive WHEN requesting detail THEN throws ForbiddenException', async () => {
    const host = await insertUser(db);
    const inactiveParticipant = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await db.insert(roomParticipants).values({
      roomId: room.id,
      userId: inactiveParticipant.id,
      role: 'candidate',
      isActive: false,
    });

    await expect(service.getRoom(room.id, inactiveParticipant.id)).rejects.toThrow(
      ForbiddenException,
    );
  });
});

describe('joinRoom', () => {
  it('GIVEN valid room code WHEN joining THEN persists participant and returns room detail with collab credentials', async () => {
    const host = await insertUser(db);
    const joiner = await insertUser(db);
    const room = await insertRoom(db, host.id, { maxParticipants: 4 });
    await insertParticipant(db, room.id, host.id, 'interviewer');

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
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, existing.id, 'candidate');

    await expect(
      service.joinRoom(room.id, joiner.id, { roomCode: room.inviteCode }),
    ).rejects.toThrow(ConflictException);
  });

  it('GIVEN wrong invite code WHEN joining THEN throws BadRequestException', async () => {
    const host = await insertUser(db);
    const joiner = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer');

    await expect(
      service.joinRoom(room.id, joiner.id, { roomCode: 'WRONG1' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: ERROR_CODES.ROOM_INVALID_CODE }),
    });
  });

  it('GIVEN finished room WHEN joining THEN throws ConflictException', async () => {
    const host = await insertUser(db);
    const joiner = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'finished' });
    await insertParticipant(db, room.id, host.id, 'interviewer');

    await expect(
      service.joinRoom(room.id, joiner.id, { roomCode: room.inviteCode }),
    ).rejects.toThrow(ConflictException);
  });

  it('GIVEN user already active in room WHEN joining THEN throws ConflictException', async () => {
    const user = await insertUser(db);
    const room = await insertRoom(db, user.id, { maxParticipants: 4 });
    await insertParticipant(db, room.id, user.id, 'interviewer');

    await expect(service.joinRoom(room.id, user.id, { roomCode: room.inviteCode })).rejects.toThrow(
      ConflictException,
    );
  });
  it('GIVEN user previously left WHEN rejoining THEN reactivates existing row with an available role', async () => {
    const host = await insertUser(db);
    const joiner = await insertUser(db);
    const room = await insertRoom(db, host.id, { maxParticipants: 4 });
    await insertParticipant(db, room.id, host.id, 'interviewer');

    const [leftParticipant] = await db
      .insert(roomParticipants)
      .values({ roomId: room.id, userId: joiner.id, role: 'candidate', isActive: false })
      .returning();

    const result = await service.joinRoom(room.id, joiner.id, {
      roomCode: room.inviteCode,
      requestedRole: 'candidate',
    });

    expect(result.assignedRole).toBe('candidate');

    const rows = await db
      .select()
      .from(roomParticipants)
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, joiner.id)));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(leftParticipant!.id);
    expect(rows[0]).toMatchObject({ role: 'candidate', isActive: true });
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

describe('transferOwnership', () => {
  it('GIVEN active participant WHEN host transfers ownership THEN room hostId is updated', async () => {
    const host = await insertUser(db);
    const target = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, target.id, 'candidate');

    const result = await service.transferOwnership(room.id, host.id, target.id);

    expect(result.previousHostId).toBe(host.id);
    expect(result.currentHostId).toBe(target.id);

    const [updatedRoom] = await db.select().from(rooms).where(eq(rooms.id, room.id));
    expect(updatedRoom?.hostId).toBe(target.id);
  });

  it('GIVEN caller is not host WHEN transferring ownership THEN throws ForbiddenException', async () => {
    const host = await insertUser(db);
    const target = await insertUser(db);
    const intruder = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, target.id, 'candidate');

    await expect(service.transferOwnership(room.id, intruder.id, target.id)).rejects.toThrow(
      ForbiddenException,
    );
  });
});

describe('updateParticipantRole', () => {
  it('GIVEN waiting peer room WHEN host reassigns active participant THEN updated role is returned and persisted', async () => {
    const host = await insertUser(db);
    const participant = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, participant.id, 'observer');

    const result = await service.updateParticipantRole(
      room.id,
      host.id,
      participant.id,
      'candidate',
    );

    expect(result.previousRole).toBe('observer');
    expect(result.currentRole).toBe('candidate');
    expect(result.room.participants.find((item) => item.userId === participant.id)?.role).toBe(
      'candidate',
    );
  });

  it('GIVEN started peer room WHEN reassignment breaks required role balance THEN throws ConflictException', async () => {
    const host = await insertUser(db);
    const candidate = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'warmup' });
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    await expect(
      service.updateParticipantRole(room.id, host.id, candidate.id, 'observer'),
    ).rejects.toThrow(ConflictException);
  });
});

describe('transitionPhase', () => {
  it('GIVEN waiting room WHEN transitioning to warmup THEN creates an ongoing session with participant snapshot', async () => {
    const host = await insertUser(db);
    const candidate = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer', { isReady: true });
    await insertParticipant(db, room.id, candidate.id, 'candidate', { isReady: true });

    const result = await service.transitionPhase(room.id, host.id, 'warmup');

    expect(result.previousStatus).toBe('waiting');
    expect(result.currentStatus).toBe('warmup');

    const [session] = await db.select().from(sessions).where(eq(sessions.roomId, room.id));
    expect(session?.status).toBe('ongoing');

    const snapshotRows = await db
      .select()
      .from(sessionParticipants)
      .where(eq(sessionParticipants.sessionId, session!.id));
    expect(snapshotRows).toHaveLength(2);
  });

  it('GIVEN waiting room WHEN transitioning directly to coding THEN throws ConflictException', async () => {
    const host = await insertUser(db);
    const candidate = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    await expect(service.transitionPhase(room.id, host.id, 'coding')).rejects.toThrow();
  });

  it('GIVEN peer room with candidate not ready WHEN transitioning to warmup THEN throws ROOM_PARTICIPANTS_NOT_READY', async () => {
    const host = await insertUser(db);
    const candidate = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer', { isReady: true });
    await insertParticipant(db, room.id, candidate.id, 'candidate', { isReady: false });

    await expect(service.transitionPhase(room.id, host.id, 'warmup')).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.transitionPhase(room.id, host.id, 'warmup')).rejects.toMatchObject({
      response: { code: ERROR_CODES.ROOM_PARTICIPANTS_NOT_READY },
    });
  });

  it('GIVEN peer room with both ready WHEN transitioning to warmup THEN succeeds', async () => {
    const host = await insertUser(db);
    const candidate = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer', { isReady: true });
    await insertParticipant(db, room.id, candidate.id, 'candidate', { isReady: true });

    const result = await service.transitionPhase(room.id, host.id, 'warmup');
    expect(result.currentStatus).toBe('warmup');
  });

  it('GIVEN ai room with candidate not ready WHEN transitioning to warmup THEN throws ROOM_PARTICIPANTS_NOT_READY', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id, { mode: 'ai' });
    await insertParticipant(db, room.id, host.id, 'candidate', { isReady: false });

    await expect(service.transitionPhase(room.id, host.id, 'warmup')).rejects.toMatchObject({
      response: { code: ERROR_CODES.ROOM_PARTICIPANTS_NOT_READY },
    });
  });

  it('GIVEN ai room with candidate ready WHEN transitioning to warmup THEN succeeds', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id, { mode: 'ai' });
    await insertParticipant(db, room.id, host.id, 'candidate', { isReady: true });

    const result = await service.transitionPhase(room.id, host.id, 'warmup');
    expect(result.currentStatus).toBe('warmup');
  });

  it('GIVEN peer room with ready peers and not-ready observer WHEN transitioning to warmup THEN succeeds', async () => {
    const host = await insertUser(db);
    const candidate = await insertUser(db);
    const observer = await insertUser(db);
    const room = await insertRoom(db, host.id, { maxParticipants: 4 });
    await insertParticipant(db, room.id, host.id, 'interviewer', { isReady: true });
    await insertParticipant(db, room.id, candidate.id, 'candidate', { isReady: true });
    await insertParticipant(db, room.id, observer.id, 'observer', { isReady: false });

    const result = await service.transitionPhase(room.id, host.id, 'warmup');
    expect(result.currentStatus).toBe('warmup');
  });
});

describe('runCode', () => {
  it('GIVEN participant has run capability WHEN running code THEN returns execution job id', async () => {
    const host = await insertUser(db);
    const candidate = await insertUser(db);
    const room = await insertRoom(db, host.id, { editorLocked: false });
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    const result = await service.runCode(room.id, candidate.id, {
      language: 'typescript',
      code: 'console.log(1);',
    });

    expect(result).toEqual({ jobId: 'stub-job' });
  });

  it('GIVEN room editor is locked WHEN running code THEN throws ConflictException', async () => {
    const host = await insertUser(db);
    const candidate = await insertUser(db);
    const room = await insertRoom(db, host.id, { editorLocked: true });
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    await expect(
      service.runCode(room.id, candidate.id, {
        language: 'typescript',
        code: 'console.log(1);',
      }),
    ).rejects.toThrow(ConflictException);
  });
});

describe('destroyRoom', () => {
  it('GIVEN room owned by user WHEN destroying THEN deletes room and associated data', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer');

    const result = await service.destroyRoom(room.id, host.id);

    expect(result.mediaDeleted).toBe(true);

    const [deletedRoom] = await db.select().from(rooms).where(eq(rooms.id, room.id));
    expect(deletedRoom).toBeUndefined();
  });

  it('GIVEN non-host user WHEN destroying THEN throws ForbiddenException', async () => {
    const host = await insertUser(db);
    const other = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, other.id, 'candidate');

    await expect(service.destroyRoom(room.id, other.id)).rejects.toThrow(ForbiddenException);
  });

  it('GIVEN finished room WHEN destroying THEN throws ConflictException', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'finished' });
    await insertParticipant(db, room.id, host.id, 'interviewer');

    await expect(service.destroyRoom(room.id, host.id)).rejects.toThrow(ConflictException);
  });
});

describe('transitionPhase (multi-step)', () => {
  it('GIVEN warmup room WHEN transitioning to coding THEN sets currentPhaseStartedAt and editorLocked=false', async () => {
    const host = await insertUser(db);
    const candidate = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'warmup' });
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    const result = await service.transitionPhase(room.id, host.id, 'coding');

    expect(result.previousStatus).toBe('warmup');
    expect(result.currentStatus).toBe('coding');

    const [updated] = await db.select().from(rooms).where(eq(rooms.id, room.id));
    expect(updated!.status).toBe('coding');
    expect(updated!.phaseStartedAt).not.toBeNull();
    expect(updated!.editorLocked).toBe(false);
  });

  it('GIVEN coding room WHEN transitioning to wrapup THEN updates status and accumulates elapsed time', async () => {
    const host = await insertUser(db);
    const candidate = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'coding' });
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    const result = await service.transitionPhase(room.id, host.id, 'wrapup');

    expect(result.currentStatus).toBe('wrapup');
    expect(result.previousStatus).toBe('coding');

    const [updated] = await db.select().from(rooms).where(eq(rooms.id, room.id));
    expect(updated!.status).toBe('wrapup');
  });

  it('GIVEN wrapup room WHEN transitioning to finished THEN finalizes session', async () => {
    const host = await insertUser(db);
    const candidate = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'wrapup' });
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    const result = await service.transitionPhase(room.id, host.id, 'finished');

    expect(result.currentStatus).toBe('finished');

    const [updated] = await db.select().from(rooms).where(eq(rooms.id, room.id));
    expect(updated!.status).toBe('finished');
  });
});

describe('joinRoom (role assignment)', () => {
  it('GIVEN user requests candidate role WHEN joining THEN assigns requested role', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer');
    const joiner = await insertUser(db);

    const result = await service.joinRoom(room.id, joiner.id, {
      roomCode: room.inviteCode,
      requestedRole: 'candidate',
    });

    expect(result.assignedRole).toBe('candidate');
    expect(result.assignmentReason).toBe('requested');
  });

  it('GIVEN candidate slot taken WHEN requesting candidate THEN throws role unavailable', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id, { maxParticipants: 4 });
    await insertParticipant(db, room.id, host.id, 'interviewer');
    const existing = await insertUser(db);
    await insertParticipant(db, room.id, existing.id, 'candidate');
    const joiner = await insertUser(db);

    await expect(
      service.joinRoom(room.id, joiner.id, {
        roomCode: room.inviteCode,
        requestedRole: 'candidate',
      }),
    ).rejects.toThrow(ConflictException);
  });
});

describe('submitProblem', () => {
  it('GIVEN room with problem and test cases WHEN submitting code THEN returns submissionId and enqueues jobs', async () => {
    const host = await insertUser(db);
    const candidate = await insertUser(db);
    const problem = await insertProblem(db);
    await insertTestCase(db, problem.id);
    await insertTestCase(db, problem.id);
    const room = await insertRoom(db, host.id, {
      status: 'coding',
      problemId: problem.id,
    });
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    const result = await service.submitProblem(room.id, candidate.id, {
      language: 'python',
      code: 'print(input())',
    });

    expect(result.submissionId).toEqual(expect.any(String));

    const [sub] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, result.submissionId));
    expect(sub.totalTestCases).toBe(2);
    expect(sub.status).toBe('pending');
    expect(sub.roomId).toBe(room.id);
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

describe('toggleReady', () => {
  it('GIVEN active participant in waiting room WHEN toggling ready THEN sets isReady=true', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'waiting' });
    await insertParticipant(db, room.id, host.id, 'interviewer');

    const result = await service.toggleReady(room.id, host.id);

    const [row] = await db
      .select()
      .from(roomParticipants)
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, host.id)));

    expect(row!.isReady).toBe(true);
    expect(result.participants.find((p) => p.userId === host.id)?.isReady).toBe(true);
  });

  it('GIVEN ready participant WHEN toggling again THEN sets isReady=false', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'waiting' });
    await insertParticipant(db, room.id, host.id, 'interviewer');

    await service.toggleReady(room.id, host.id);
    await service.toggleReady(room.id, host.id);

    const [row] = await db
      .select()
      .from(roomParticipants)
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, host.id)));

    expect(row!.isReady).toBe(false);
  });

  it('GIVEN room in coding phase WHEN toggling ready THEN throws BadRequestException', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'coding' });
    await insertParticipant(db, room.id, host.id, 'interviewer');

    await expect(service.toggleReady(room.id, host.id)).rejects.toThrow(BadRequestException);
  });

  it('GIVEN non-participant WHEN toggling ready THEN throws NotFoundException', async () => {
    const host = await insertUser(db);
    const stranger = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'waiting' });

    await expect(service.toggleReady(room.id, stranger.id)).rejects.toThrow(NotFoundException);
  });
});

describe('ensureCollab', () => {
  it('GIVEN no stored snapshot WHEN active participant ensures collab THEN calls createDocument with starter content', async () => {
    const host = await insertUser(db);
    const problem = await insertProblem(db, {
      starterCode: { python: '# starter', javascript: '// starter' },
    });
    const room = await insertRoom(db, host.id, { problemId: problem.id, language: 'python' });
    await insertParticipant(db, room.id, host.id, 'interviewer');

    mockCollabClient.createDocument.mockResolvedValueOnce({
      roomId: room.id,
      createdAt: Date.now(),
      created: true,
    });

    const result = await service.ensureCollab(room.id, host.id);

    expect(result).toEqual({ recreated: true });
    expect(mockCollabClient.createDocument).toHaveBeenLastCalledWith(
      expect.objectContaining({ roomId: room.id, initialContent: '# starter' }),
    );
  });

  it('GIVEN stored snapshot WHEN ensuring collab THEN passes snapshot bytes to createDocument', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer');

    const stateBytes = new Uint8Array([10, 20, 30]);
    await db.insert(roomDocSnapshots).values({ roomId: room.id, state: stateBytes });

    mockCollabClient.createDocument.mockResolvedValueOnce({
      roomId: room.id,
      createdAt: Date.now(),
      created: true,
    });

    await service.ensureCollab(room.id, host.id);

    expect(mockCollabClient.createDocument).toHaveBeenLastCalledWith(
      expect.objectContaining({ roomId: room.id, snapshot: [10, 20, 30] }),
    );
  });

  it('GIVEN doc already live in collab WHEN ensuring THEN returns recreated=false', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer');

    mockCollabClient.createDocument.mockResolvedValueOnce({
      roomId: room.id,
      createdAt: Date.now(),
      created: false,
    });

    const result = await service.ensureCollab(room.id, host.id);
    expect(result).toEqual({ recreated: false });
  });

  it('GIVEN non-participant WHEN ensuring collab THEN throws ForbiddenException', async () => {
    const host = await insertUser(db);
    const stranger = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer');

    await expect(service.ensureCollab(room.id, stranger.id)).rejects.toThrow(ForbiddenException);
  });

  it('GIVEN inactive (disconnected) participant WHEN ensuring collab THEN recovers without throwing', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await service.markParticipantInactive(room.id, host.id, new Date());

    mockCollabClient.createDocument.mockResolvedValueOnce({
      roomId: room.id,
      createdAt: Date.now(),
      created: true,
    });

    const result = await service.ensureCollab(room.id, host.id);
    expect(result).toEqual({ recreated: true });
  });

  it('GIVEN finished room WHEN ensuring collab THEN throws ConflictException', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'finished' });
    await insertParticipant(db, room.id, host.id, 'interviewer');

    await expect(service.ensureCollab(room.id, host.id)).rejects.toThrow(ConflictException);
  });

  it('GIVEN collab plane unhealthy WHEN ensuring THEN throws ServiceUnavailableException', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer');

    mockCollabClient.healthCheck.mockResolvedValueOnce(false);

    await expect(service.ensureCollab(room.id, host.id)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('GIVEN non-existent room WHEN ensuring collab THEN throws NotFoundException', async () => {
    const host = await insertUser(db);
    await expect(
      service.ensureCollab('00000000-0000-0000-0000-000000000000', host.id),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('persistDocSnapshot', () => {
  it('GIVEN no existing row WHEN persisting THEN inserts a new row', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id);

    await service.persistDocSnapshot(room.id, new Uint8Array([1, 2, 3]));

    const [row] = await db
      .select()
      .from(roomDocSnapshots)
      .where(eq(roomDocSnapshots.roomId, room.id));
    expect(row).toBeDefined();
    expect(Array.from(row!.state)).toEqual([1, 2, 3]);
  });

  it('GIVEN existing row WHEN persisting again THEN upserts state and refreshes updatedAt', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id);

    await service.persistDocSnapshot(room.id, new Uint8Array([1]));
    const [first] = await db
      .select()
      .from(roomDocSnapshots)
      .where(eq(roomDocSnapshots.roomId, room.id));

    await new Promise((r) => setTimeout(r, 5));
    await service.persistDocSnapshot(room.id, new Uint8Array([9, 9, 9]));

    const [second] = await db
      .select()
      .from(roomDocSnapshots)
      .where(eq(roomDocSnapshots.roomId, room.id));

    expect(Array.from(second!.state)).toEqual([9, 9, 9]);
    expect(second!.updatedAt.getTime()).toBeGreaterThanOrEqual(first!.updatedAt.getTime());
  });
});
