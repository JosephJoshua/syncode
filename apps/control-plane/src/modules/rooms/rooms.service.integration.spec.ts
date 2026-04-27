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

  it('GIVEN problemId WHEN creating room THEN passes full starterCode map as initialContentByLanguage to collab', async () => {
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
      expect.objectContaining({
        initialContentByLanguage: { python: '# starter', javascript: '// starter' },
        initialLanguage: 'python',
      }),
    );
  });

  it('GIVEN no problemId WHEN creating room THEN passes no initialContentByLanguage to collab', async () => {
    const user = await insertUser(db);

    await service.createRoom(user.id, {
      mode: 'peer',
      config: { maxParticipants: 2, maxDuration: 120, isPrivate: true },
    });

    expect(mockCollabClient.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({ initialContentByLanguage: undefined, initialLanguage: undefined }),
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

  it('GIVEN user already active in room WHEN joining THEN idempotently returns current role with a fresh collab token', async () => {
    const user = await insertUser(db);
    const room = await insertRoom(db, user.id, { maxParticipants: 4 });
    await insertParticipant(db, room.id, user.id, 'interviewer');

    const result = await service.joinRoom(room.id, user.id, { roomCode: room.inviteCode });

    expect(result.assignedRole).toBe('interviewer');
    expect(result.assignmentReason).toBe('auto-assigned');
    expect(result.collabToken).toBeTypeOf('string');

    const activeParticipants = await db
      .select()
      .from(roomParticipants)
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.isActive, true)));
    expect(activeParticipants).toHaveLength(1);
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

describe('joinRoom code requirement', () => {
  it('GIVEN a public room AND no roomCode WHEN joining THEN succeeds with assigned role', async () => {
    const host = await insertUser(db);
    const joiner = await insertUser(db);
    const room = await insertRoom(db, host.id, { isPrivate: false, maxParticipants: 4 });
    await insertParticipant(db, room.id, host.id, 'interviewer');

    const result = await service.joinRoom(room.id, joiner.id, {});

    expect(result.assignedRole).toBe('candidate');
    expect(result.room.roomId).toBe(room.id);

    const rows = await db
      .select()
      .from(roomParticipants)
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, joiner.id)));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ role: 'candidate', isActive: true });
  });

  it('GIVEN a public room AND wrong roomCode WHEN joining THEN throws BadRequestException with ROOM_INVALID_CODE', async () => {
    const host = await insertUser(db);
    const joiner = await insertUser(db);
    const room = await insertRoom(db, host.id, { isPrivate: false, maxParticipants: 4 });
    await insertParticipant(db, room.id, host.id, 'interviewer');

    await expect(
      service.joinRoom(room.id, joiner.id, { roomCode: 'WRONG1' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: ERROR_CODES.ROOM_INVALID_CODE }),
    });
  });

  it('GIVEN a private room AND no roomCode WHEN joining THEN throws BadRequestException with ROOM_INVALID_CODE', async () => {
    const host = await insertUser(db);
    const joiner = await insertUser(db);
    const room = await insertRoom(db, host.id, { isPrivate: true, maxParticipants: 4 });
    await insertParticipant(db, room.id, host.id, 'interviewer');

    await expect(service.joinRoom(room.id, joiner.id, {})).rejects.toMatchObject({
      response: expect.objectContaining({ code: ERROR_CODES.ROOM_INVALID_CODE }),
    });
  });

  it('GIVEN an inactive participant of a private room WHEN re-joining without roomCode THEN reactivates the participant', async () => {
    const host = await insertUser(db);
    const returner = await insertUser(db);
    const room = await insertRoom(db, host.id, { isPrivate: true, maxParticipants: 4 });
    await insertParticipant(db, room.id, host.id, 'interviewer');

    await db
      .insert(roomParticipants)
      .values({ roomId: room.id, userId: returner.id, role: 'candidate', isActive: false });

    const result = await service.joinRoom(room.id, returner.id, {});

    expect(result.assignedRole).toBe('candidate');

    const rows = await db
      .select()
      .from(roomParticipants)
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, returner.id)));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ role: 'candidate', isActive: true });
    expect(rows[0]!.leftAt).toBeNull();
  });

  it('GIVEN an inactive participant of a public room WHEN re-joining without roomCode THEN reactivates the participant', async () => {
    const host = await insertUser(db);
    const returner = await insertUser(db);
    const room = await insertRoom(db, host.id, { isPrivate: false, maxParticipants: 4 });
    await insertParticipant(db, room.id, host.id, 'interviewer');

    await db
      .insert(roomParticipants)
      .values({ roomId: room.id, userId: returner.id, role: 'candidate', isActive: false });

    const result = await service.joinRoom(room.id, returner.id, {});

    expect(result.assignedRole).toBe('candidate');

    const rows = await db
      .select()
      .from(roomParticipants)
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, returner.id)));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ role: 'candidate', isActive: true });
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

  it('GIVEN waiting peer room WHEN reassignment breaks required role balance THEN throws ConflictException', async () => {
    const host = await insertUser(db);
    const candidate = await insertUser(db);
    const extra = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');
    await insertParticipant(db, room.id, extra.id, 'observer');

    await expect(
      service.updateParticipantRole(room.id, host.id, extra.id, 'interviewer'),
    ).rejects.toThrow(ConflictException);
  });

  it('GIVEN room in warmup WHEN host updates role THEN throws BadRequestException with ROOM_ROLES_LOCKED', async () => {
    const host = await insertUser(db);
    const participant = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'warmup' });
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, participant.id, 'candidate');

    await expect(
      service.updateParticipantRole(room.id, host.id, participant.id, 'observer'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: ERROR_CODES.ROOM_ROLES_LOCKED }),
    });
  });

  it('GIVEN room in coding WHEN host updates role THEN throws BadRequestException with ROOM_ROLES_LOCKED', async () => {
    const host = await insertUser(db);
    const participant = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'coding' });
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, participant.id, 'candidate');

    await expect(
      service.updateParticipantRole(room.id, host.id, participant.id, 'observer'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: ERROR_CODES.ROOM_ROLES_LOCKED }),
    });
  });
});

describe('removeParticipant', () => {
  it('GIVEN host WHEN removing active participant THEN row is inactive with removedAt and leftAt set', async () => {
    const host = await insertUser(db);
    const target = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, target.id, 'candidate');

    await service.removeParticipant(room.id, host.id, target.id);

    const [row] = await db
      .select()
      .from(roomParticipants)
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, target.id)));
    expect(row?.isActive).toBe(false);
    expect(row?.removedAt).toBeInstanceOf(Date);
    expect(row?.leftAt).toBeInstanceOf(Date);

    expect(mockCollabClient.kickUser).toHaveBeenCalledWith(
      room.id,
      expect.objectContaining({ userId: target.id }),
    );
  });

  it('GIVEN non-host caller WHEN removing participant THEN throws ForbiddenException', async () => {
    const host = await insertUser(db);
    const intruder = await insertUser(db);
    const target = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, intruder.id, 'observer');
    await insertParticipant(db, room.id, target.id, 'candidate');

    await expect(service.removeParticipant(room.id, intruder.id, target.id)).rejects.toThrow(
      ForbiddenException,
    );

    const [row] = await db
      .select()
      .from(roomParticipants)
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, target.id)));
    expect(row?.isActive).toBe(true);
  });

  it('GIVEN host WHEN removing self THEN throws BadRequestException', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer');

    await expect(service.removeParticipant(room.id, host.id, host.id)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('GIVEN no such participant WHEN removing THEN throws NotFoundException', async () => {
    const host = await insertUser(db);
    const ghost = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer');

    await expect(service.removeParticipant(room.id, host.id, ghost.id)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('GIVEN participant already inactive WHEN removing THEN throws NotFoundException', async () => {
    const host = await insertUser(db);
    const target = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await db
      .insert(roomParticipants)
      .values({ roomId: room.id, userId: target.id, role: 'candidate', isActive: false });

    await expect(service.removeParticipant(room.id, host.id, target.id)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('GIVEN non-existent room WHEN removing THEN throws NotFoundException', async () => {
    const host = await insertUser(db);
    const target = await insertUser(db);

    await expect(
      service.removeParticipant('00000000-0000-0000-0000-000000000000', host.id, target.id),
    ).rejects.toThrow(NotFoundException);
  });

  it('GIVEN removed participant WHEN re-joining via joinRoom THEN throws ForbiddenException with ROOM_PARTICIPANT_REMOVED', async () => {
    const host = await insertUser(db);
    const target = await insertUser(db);
    const room = await insertRoom(db, host.id, { maxParticipants: 4 });
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, target.id, 'candidate');

    await service.removeParticipant(room.id, host.id, target.id);

    await expect(
      service.joinRoom(room.id, target.id, { roomCode: room.inviteCode }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: ERROR_CODES.ROOM_PARTICIPANT_REMOVED }),
    });
  });

  it('GIVEN collab kickUser throws WHEN removing THEN DB state still committed and error is swallowed', async () => {
    const host = await insertUser(db);
    const target = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, target.id, 'candidate');

    mockCollabClient.kickUser.mockRejectedValueOnce(new Error('collab down'));

    await expect(service.removeParticipant(room.id, host.id, target.id)).resolves.toBeUndefined();

    const [row] = await db
      .select()
      .from(roomParticipants)
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, target.id)));
    expect(row?.isActive).toBe(false);
    expect(row?.removedAt).toBeInstanceOf(Date);
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

  it('GIVEN peer room with 2 active participants WHEN transitioning to finished THEN all participants flip to inactive with leftAt', async () => {
    const host = await insertUser(db);
    const candidate = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'wrapup' });
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    await service.transitionPhase(room.id, host.id, 'finished');

    const rows = await db
      .select()
      .from(roomParticipants)
      .where(eq(roomParticipants.roomId, room.id));

    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.isActive).toBe(false);
      expect(row.leftAt).toBeInstanceOf(Date);
      // Not a removal — just a cascade on room end.
      expect(row.removedAt).toBeNull();
    }
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

describe('authorizeJoin', () => {
  it('GIVEN active participant WHEN authorizing THEN returns authorized', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id);
    const joiner = await insertUser(db);
    await insertParticipant(db, room.id, joiner.id, 'candidate');

    const result = await service.authorizeJoin(room.id, joiner.id);

    expect(result).toEqual({ authorized: true });
  });

  it('GIVEN room does not exist WHEN authorizing THEN returns not authorized with room-not-found', async () => {
    const joiner = await insertUser(db);

    const result = await service.authorizeJoin('00000000-0000-4000-8000-000000000000', joiner.id);

    expect(result).toEqual({ authorized: false, reason: 'room-not-found' });
  });

  it('GIVEN room finished WHEN authorizing THEN returns not authorized with room-finished', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'finished' });
    const joiner = await insertUser(db);
    await insertParticipant(db, room.id, joiner.id, 'candidate');

    const result = await service.authorizeJoin(room.id, joiner.id);

    expect(result).toEqual({ authorized: false, reason: 'room-finished' });
  });

  it('GIVEN user is not a participant WHEN authorizing THEN returns not authorized with not-participant', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id);
    const stranger = await insertUser(db);

    const result = await service.authorizeJoin(room.id, stranger.id);

    expect(result).toEqual({ authorized: false, reason: 'not-participant' });
  });

  it('GIVEN participant was removed WHEN authorizing THEN returns not authorized with participant-removed', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id);
    const removed = await insertUser(db);
    const participant = await insertParticipant(db, room.id, removed.id, 'candidate');
    await db
      .update(roomParticipants)
      .set({ removedAt: new Date(), isActive: false })
      .where(eq(roomParticipants.id, participant!.id));

    const result = await service.authorizeJoin(room.id, removed.id);

    expect(result).toEqual({ authorized: false, reason: 'participant-removed' });
  });
});

describe('recordParticipantHeartbeats', () => {
  it('GIVEN active participants WHEN recording heartbeats THEN bumps last_heartbeat_at for each and returns count', async () => {
    const host = await insertUser(db);
    const joiner = await insertUser(db);
    const room1 = await insertRoom(db, host.id);
    const room2 = await insertRoom(db, host.id);
    await insertParticipant(db, room1.id, host.id, 'interviewer');
    await insertParticipant(db, room1.id, joiner.id, 'candidate');
    await insertParticipant(db, room2.id, host.id, 'interviewer');

    const before = Date.now();
    const updated = await service.recordParticipantHeartbeats([
      { roomId: room1.id, userId: host.id },
      { roomId: room1.id, userId: joiner.id },
      { roomId: room2.id, userId: host.id },
    ]);
    const after = Date.now();

    expect(updated).toBe(3);

    const rows = await db
      .select()
      .from(roomParticipants)
      .where(eq(roomParticipants.roomId, room1.id));
    for (const row of rows) {
      expect(row.lastHeartbeatAt).not.toBeNull();
      const ts = row.lastHeartbeatAt!.getTime();
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    }
  });

  it('GIVEN inactive participant in batch WHEN recording heartbeats THEN inactive row is not touched', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id);
    const active = await insertUser(db);
    const inactive = await insertUser(db);
    await insertParticipant(db, room.id, active.id, 'candidate');
    await insertParticipant(db, room.id, inactive.id, 'candidate');
    // Mark one inactive
    await db
      .update(roomParticipants)
      .set({ isActive: false, leftAt: new Date('2026-04-01T00:00:00Z') })
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, inactive.id)));

    const updated = await service.recordParticipantHeartbeats([
      { roomId: room.id, userId: active.id },
      { roomId: room.id, userId: inactive.id },
    ]);

    expect(updated).toBe(1);

    const [activeRow] = await db
      .select()
      .from(roomParticipants)
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, active.id)));
    expect(activeRow!.lastHeartbeatAt).not.toBeNull();

    const [inactiveRow] = await db
      .select()
      .from(roomParticipants)
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, inactive.id)));
    expect(inactiveRow!.lastHeartbeatAt).toBeNull();
  });

  it('GIVEN empty participants list WHEN recording heartbeats THEN returns 0 and does not touch rows', async () => {
    const host = await insertUser(db);
    const room = await insertRoom(db, host.id);
    await insertParticipant(db, room.id, host.id, 'interviewer');

    const updated = await service.recordParticipantHeartbeats([]);

    expect(updated).toBe(0);

    const [row] = await db
      .select()
      .from(roomParticipants)
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, host.id)));
    expect(row!.lastHeartbeatAt).toBeNull();
  });
});

describe('browsePublicRooms', () => {
  const defaultQuery = { limit: 10 } as const;

  it('GIVEN a private and a public room WHEN browsing THEN only the public room is returned', async () => {
    const browser = await insertUser(db);
    const host = await insertUser(db);
    const privateRoom = await insertRoom(db, host.id, { isPrivate: true, status: 'waiting' });
    await insertParticipant(db, privateRoom.id, host.id, 'interviewer');
    const publicRoom = await insertRoom(db, host.id, { isPrivate: false, status: 'waiting' });
    await insertParticipant(db, publicRoom.id, host.id, 'interviewer');

    const result = await service.browsePublicRooms(browser.id, defaultQuery);

    expect(result.data.map((r) => r.roomId)).toEqual([publicRoom.id]);
  });

  it('GIVEN a finished public room and a waiting public room WHEN browsing THEN only the non-finished room is returned', async () => {
    const browser = await insertUser(db);
    const host = await insertUser(db);
    const finished = await insertRoom(db, host.id, { isPrivate: false, status: 'finished' });
    await insertParticipant(db, finished.id, host.id, 'interviewer');
    const waiting = await insertRoom(db, host.id, { isPrivate: false, status: 'waiting' });
    await insertParticipant(db, waiting.id, host.id, 'interviewer');

    const result = await service.browsePublicRooms(browser.id, defaultQuery);

    expect(result.data.map((r) => r.roomId)).toEqual([waiting.id]);
  });

  it('GIVEN a full public room and a not-full public room WHEN browsing THEN only the not-full room is returned', async () => {
    const browser = await insertUser(db);
    const host = await insertUser(db);
    const second = await insertUser(db);

    const fullRoom = await insertRoom(db, host.id, {
      isPrivate: false,
      status: 'coding',
      maxParticipants: 2,
    });
    await insertParticipant(db, fullRoom.id, host.id, 'interviewer');
    await insertParticipant(db, fullRoom.id, second.id, 'candidate');

    const openRoom = await insertRoom(db, host.id, {
      isPrivate: false,
      status: 'waiting',
      maxParticipants: 2,
    });
    await insertParticipant(db, openRoom.id, host.id, 'interviewer');

    const result = await service.browsePublicRooms(browser.id, defaultQuery);

    expect(result.data.map((r) => r.roomId)).toEqual([openRoom.id]);
  });

  it('GIVEN public waiting and coding rooms WHEN filtering by status=waiting THEN only waiting is returned', async () => {
    const browser = await insertUser(db);
    const host = await insertUser(db);
    const waiting = await insertRoom(db, host.id, { isPrivate: false, status: 'waiting' });
    await insertParticipant(db, waiting.id, host.id, 'interviewer');
    const coding = await insertRoom(db, host.id, { isPrivate: false, status: 'coding' });
    await insertParticipant(db, coding.id, host.id, 'interviewer');

    const result = await service.browsePublicRooms(browser.id, {
      ...defaultQuery,
      status: 'waiting',
    });

    expect(result.data.map((r) => r.roomId)).toEqual([waiting.id]);
  });

  it('GIVEN public python and javascript rooms WHEN filtering by language=python THEN only python is returned', async () => {
    const browser = await insertUser(db);
    const host = await insertUser(db);
    const py = await insertRoom(db, host.id, {
      isPrivate: false,
      status: 'waiting',
      language: 'python',
    });
    await insertParticipant(db, py.id, host.id, 'interviewer');
    const js = await insertRoom(db, host.id, {
      isPrivate: false,
      status: 'waiting',
      language: 'javascript',
    });
    await insertParticipant(db, js.id, host.id, 'interviewer');

    const result = await service.browsePublicRooms(browser.id, {
      ...defaultQuery,
      language: 'python',
    });

    expect(result.data.map((r) => r.roomId)).toEqual([py.id]);
    expect(result.data[0]!.language).toBe('python');
  });

  it('GIVEN public rooms linked to easy and hard problems WHEN filtering by difficulty=easy THEN only the easy-linked room is returned', async () => {
    const browser = await insertUser(db);
    const host = await insertUser(db);
    const easyProblem = await insertProblem(db, { difficulty: 'easy' });
    const hardProblem = await insertProblem(db, { difficulty: 'hard' });
    const easyRoom = await insertRoom(db, host.id, {
      isPrivate: false,
      status: 'waiting',
      problemId: easyProblem.id,
    });
    await insertParticipant(db, easyRoom.id, host.id, 'interviewer');
    const hardRoom = await insertRoom(db, host.id, {
      isPrivate: false,
      status: 'waiting',
      problemId: hardProblem.id,
    });
    await insertParticipant(db, hardRoom.id, host.id, 'interviewer');

    const result = await service.browsePublicRooms(browser.id, {
      ...defaultQuery,
      difficulty: 'easy',
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.roomId).toBe(easyRoom.id);
    expect(result.data[0]!.problemDifficulty).toBe('easy');
  });

  it('GIVEN public rooms with different problem titles WHEN searching by substring THEN matches case-insensitively', async () => {
    const browser = await insertUser(db);
    const host = await insertUser(db);
    const twoSum = await insertProblem(db, { title: 'Two Sum' });
    const merge = await insertProblem(db, { title: 'Merge Intervals' });
    const twoSumRoom = await insertRoom(db, host.id, {
      isPrivate: false,
      status: 'waiting',
      problemId: twoSum.id,
    });
    await insertParticipant(db, twoSumRoom.id, host.id, 'interviewer');
    const mergeRoom = await insertRoom(db, host.id, {
      isPrivate: false,
      status: 'waiting',
      problemId: merge.id,
    });
    await insertParticipant(db, mergeRoom.id, host.id, 'interviewer');

    const lower = await service.browsePublicRooms(browser.id, { ...defaultQuery, search: 'two' });
    expect(lower.data.map((r) => r.roomId)).toEqual([twoSumRoom.id]);

    const upper = await service.browsePublicRooms(browser.id, { ...defaultQuery, search: 'TWO' });
    expect(upper.data.map((r) => r.roomId)).toEqual([twoSumRoom.id]);
  });

  it('GIVEN a problem title with a literal % WHEN searching for % THEN only the %-titled room is returned', async () => {
    const browser = await insertUser(db);
    const host = await insertUser(db);
    const twoSum = await insertProblem(db, { title: 'Two Sum' });
    const percent = await insertProblem(db, { title: '100%' });
    const twoSumRoom = await insertRoom(db, host.id, {
      isPrivate: false,
      status: 'waiting',
      problemId: twoSum.id,
    });
    await insertParticipant(db, twoSumRoom.id, host.id, 'interviewer');
    const percentRoom = await insertRoom(db, host.id, {
      isPrivate: false,
      status: 'waiting',
      problemId: percent.id,
    });
    await insertParticipant(db, percentRoom.id, host.id, 'interviewer');

    const result = await service.browsePublicRooms(browser.id, { ...defaultQuery, search: '%' });

    expect(result.data.map((r) => r.roomId)).toEqual([percentRoom.id]);
  });

  it('GIVEN 3 public rooms WHEN paginating with limit=2 THEN paginates correctly', async () => {
    const browser = await insertUser(db);
    const host = await insertUser(db);

    const roomIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const room = await insertRoom(db, host.id, {
        isPrivate: false,
        status: 'waiting',
        createdAt: new Date(`2026-01-0${i + 1}T00:00:00Z`),
      });
      await insertParticipant(db, room.id, host.id, 'interviewer');
      roomIds.push(room.id);
    }

    const page1 = await service.browsePublicRooms(browser.id, { limit: 2 });
    expect(page1.data).toHaveLength(2);
    expect(page1.pagination.hasMore).toBe(true);
    expect(page1.pagination.nextCursor).not.toBeNull();

    const page2 = await service.browsePublicRooms(browser.id, {
      limit: 2,
      cursor: page1.pagination.nextCursor!,
    });
    expect(page2.data).toHaveLength(1);
    expect(page2.pagination.hasMore).toBe(false);
    expect(page2.pagination.nextCursor).toBeNull();

    const seenIds = [...page1.data, ...page2.data].map((r) => r.roomId);
    expect(new Set(seenIds).size).toBe(3);
  });

  it('GIVEN host has null displayName and an avatar key WHEN browsing THEN hostName falls back to username and hostAvatarUrl is resolved', async () => {
    const browser = await insertUser(db);
    const host = await insertUser(db, {
      username: 'alice-host',
      displayName: null,
      avatarUrl: 'avatars/alice.png',
    });
    const room = await insertRoom(db, host.id, { isPrivate: false, status: 'waiting' });
    await insertParticipant(db, room.id, host.id, 'interviewer');

    const result = await service.browsePublicRooms(browser.id, defaultQuery);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.hostName).toBe('alice-host');
    expect(result.data[0]!.hostAvatarUrl).toBe('https://s3.example.com/presigned-get');
  });

  it('GIVEN a public room the caller is not a participant of WHEN browsing THEN room is still returned', async () => {
    const browser = await insertUser(db);
    const host = await insertUser(db);
    const other = await insertUser(db);
    const room = await insertRoom(db, host.id, {
      isPrivate: false,
      status: 'waiting',
      maxParticipants: 4,
    });
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, other.id, 'candidate');

    const result = await service.browsePublicRooms(browser.id, defaultQuery);

    expect(result.data.map((r) => r.roomId)).toEqual([room.id]);
  });

  it('GIVEN 3 public rooms with spaced-apart createdAt WHEN browsing THEN results are ordered createdAt desc', async () => {
    const browser = await insertUser(db);
    const host = await insertUser(db);

    const oldest = await insertRoom(db, host.id, {
      isPrivate: false,
      status: 'waiting',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    await insertParticipant(db, oldest.id, host.id, 'interviewer');

    const middle = await insertRoom(db, host.id, {
      isPrivate: false,
      status: 'waiting',
      createdAt: new Date('2026-01-02T00:00:00Z'),
    });
    await insertParticipant(db, middle.id, host.id, 'interviewer');

    const newest = await insertRoom(db, host.id, {
      isPrivate: false,
      status: 'waiting',
      createdAt: new Date('2026-01-03T00:00:00Z'),
    });
    await insertParticipant(db, newest.id, host.id, 'interviewer');

    const result = await service.browsePublicRooms(browser.id, defaultQuery);

    expect(result.data.map((r) => r.roomId)).toEqual([newest.id, middle.id, oldest.id]);
  });

  it('GIVEN the caller is an active participant of a room WHEN browsing THEN isParticipant is true for that room', async () => {
    const host = await insertUser(db);
    const caller = await insertUser(db);
    const room = await insertRoom(db, host.id, {
      isPrivate: false,
      status: 'waiting',
      maxParticipants: 4,
    });
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, caller.id, 'candidate');

    const result = await service.browsePublicRooms(caller.id, defaultQuery);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.roomId).toBe(room.id);
    expect(result.data[0]!.isParticipant).toBe(true);
  });

  it('GIVEN the caller is NOT a participant of a room WHEN browsing THEN isParticipant is false', async () => {
    const host = await insertUser(db);
    const caller = await insertUser(db);
    const room = await insertRoom(db, host.id, {
      isPrivate: false,
      status: 'waiting',
      maxParticipants: 4,
    });
    await insertParticipant(db, room.id, host.id, 'interviewer');

    const result = await service.browsePublicRooms(caller.id, defaultQuery);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.roomId).toBe(room.id);
    expect(result.data[0]!.isParticipant).toBe(false);
  });

  it('GIVEN the caller was a participant but is now inactive WHEN browsing THEN isParticipant is false', async () => {
    const host = await insertUser(db);
    const caller = await insertUser(db);
    const room = await insertRoom(db, host.id, {
      isPrivate: false,
      status: 'waiting',
      maxParticipants: 4,
    });
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, caller.id, 'candidate');

    await db
      .update(roomParticipants)
      .set({ isActive: false, leftAt: new Date() })
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, caller.id)));

    const result = await service.browsePublicRooms(caller.id, defaultQuery);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.roomId).toBe(room.id);
    expect(result.data[0]!.isParticipant).toBe(false);
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

describe('changeLanguage', () => {
  it('GIVEN a candidate participant WHEN switching language THEN rooms.language updated AND response reflects new language', async () => {
    const host = await insertUser(db);
    const candidate = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'coding', language: 'python' });
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    const result = await service.changeLanguage(room.id, candidate.id, 'javascript');

    expect(result.language).toBe('javascript');
    const [updated] = await db.select().from(rooms).where(eq(rooms.id, room.id));
    expect(updated!.language).toBe('javascript');
  });

  it('GIVEN an interviewer participant WHEN switching language THEN succeeds', async () => {
    const host = await insertUser(db);
    const candidate = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'coding', language: 'python' });
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    const result = await service.changeLanguage(room.id, host.id, 'typescript');

    expect(result.language).toBe('typescript');
    const [updated] = await db.select().from(rooms).where(eq(rooms.id, room.id));
    expect(updated!.language).toBe('typescript');
  });

  it('GIVEN an observer participant (non-host) WHEN switching language THEN ForbiddenException with ROOM_PERMISSION_DENIED', async () => {
    const host = await insertUser(db);
    const candidate = await insertUser(db);
    const observer = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'coding', language: 'python' });
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');
    await insertParticipant(db, room.id, observer.id, 'observer');

    await expect(service.changeLanguage(room.id, observer.id, 'javascript')).rejects.toMatchObject({
      response: expect.objectContaining({ code: ERROR_CODES.ROOM_PERMISSION_DENIED }),
    });
    await expect(service.changeLanguage(room.id, observer.id, 'javascript')).rejects.toThrow(
      ForbiddenException,
    );

    const [unchanged] = await db.select().from(rooms).where(eq(rooms.id, room.id));
    expect(unchanged!.language).toBe('python');
  });

  it('GIVEN a finished room WHEN switching THEN BadRequestException with ROOM_INVALID_STATE', async () => {
    const host = await insertUser(db);
    const candidate = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'finished', language: 'python' });
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    await expect(service.changeLanguage(room.id, candidate.id, 'javascript')).rejects.toMatchObject(
      {
        response: expect.objectContaining({ code: ERROR_CODES.ROOM_INVALID_STATE }),
      },
    );
    await expect(service.changeLanguage(room.id, candidate.id, 'javascript')).rejects.toThrow(
      BadRequestException,
    );

    const [unchanged] = await db.select().from(rooms).where(eq(rooms.id, room.id));
    expect(unchanged!.language).toBe('python');
  });

  it('GIVEN a non-participant WHEN switching THEN ForbiddenException with ROOM_ACCESS_DENIED', async () => {
    const host = await insertUser(db);
    const stranger = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'coding', language: 'python' });
    await insertParticipant(db, room.id, host.id, 'interviewer');

    await expect(service.changeLanguage(room.id, stranger.id, 'javascript')).rejects.toMatchObject({
      response: expect.objectContaining({ code: ERROR_CODES.ROOM_ACCESS_DENIED }),
    });
    await expect(service.changeLanguage(room.id, stranger.id, 'javascript')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('GIVEN a host who is currently an observer WHEN switching THEN succeeds (host override)', async () => {
    const host = await insertUser(db);
    const candidate = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'coding', language: 'python' });
    // host is stored as observer here to exercise host override
    await insertParticipant(db, room.id, host.id, 'observer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    const result = await service.changeLanguage(room.id, host.id, 'typescript');

    expect(result.language).toBe('typescript');
    const [updated] = await db.select().from(rooms).where(eq(rooms.id, room.id));
    expect(updated!.language).toBe('typescript');
  });

  it('GIVEN same language as current WHEN switching THEN idempotent — response language equals input; no DB update side-effects observable', async () => {
    const host = await insertUser(db);
    const candidate = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'coding', language: 'python' });
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    const [before] = await db.select().from(rooms).where(eq(rooms.id, room.id));

    const result = await service.changeLanguage(room.id, candidate.id, 'python');

    expect(result.language).toBe('python');
    const [after] = await db.select().from(rooms).where(eq(rooms.id, room.id));
    expect(after!.language).toBe('python');
    // No observable change — updatedAt stays the same since we skipped the UPDATE.
    expect(after!.updatedAt).toEqual(before!.updatedAt);
  });

  it('GIVEN collab-plane throws WHEN switching THEN DB is still updated AND response reflects new language (best-effort broadcast)', async () => {
    const host = await insertUser(db);
    const candidate = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'coding', language: 'python' });
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    mockCollabClient.changeLanguage.mockRejectedValueOnce(new Error('boom'));

    const result = await service.changeLanguage(room.id, candidate.id, 'javascript');

    expect(result.language).toBe('javascript');
    const [updated] = await db.select().from(rooms).where(eq(rooms.id, room.id));
    expect(updated!.language).toBe('javascript');
  });

  it('GIVEN a non-existent room WHEN switching THEN NotFoundException with ROOM_NOT_FOUND', async () => {
    const user = await insertUser(db);

    await expect(
      service.changeLanguage('00000000-0000-0000-0000-000000000000', user.id, 'python'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: ERROR_CODES.ROOM_NOT_FOUND }),
    });
    await expect(
      service.changeLanguage('00000000-0000-0000-0000-000000000000', user.id, 'python'),
    ).rejects.toThrow(NotFoundException);
  });

  it('GIVEN an ongoing session for the room WHEN changing language THEN sessions.language is updated too', async () => {
    const host = await insertUser(db);
    const candidate = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'coding', language: 'python' });
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    const [session] = await db
      .insert(sessions)
      .values({
        roomId: room.id,
        mode: room.mode,
        language: 'python',
        status: 'ongoing',
        startedAt: new Date(),
      })
      .returning();

    await service.changeLanguage(room.id, candidate.id, 'javascript');

    const [updatedSession] = await db.select().from(sessions).where(eq(sessions.id, session!.id));
    expect(updatedSession!.language).toBe('javascript');
  });

  it('GIVEN no ongoing session (waiting state) WHEN changing language THEN no session row is updated (no error)', async () => {
    const host = await insertUser(db);
    const candidate = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'waiting', language: 'python' });
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    await expect(
      service.changeLanguage(room.id, candidate.id, 'javascript'),
    ).resolves.toMatchObject({ language: 'javascript' });

    const sessionRows = await db.select().from(sessions).where(eq(sessions.roomId, room.id));
    expect(sessionRows).toHaveLength(0);
  });

  it("GIVEN a finished session WHEN changing language THEN that finished session's language is NOT touched", async () => {
    const host = await insertUser(db);
    const candidate = await insertUser(db);
    const room = await insertRoom(db, host.id, { status: 'coding', language: 'python' });
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, candidate.id, 'candidate');

    const [finishedSession] = await db
      .insert(sessions)
      .values({
        roomId: room.id,
        mode: room.mode,
        language: 'python',
        status: 'finished',
        startedAt: new Date(Date.now() - 60_000),
        finishedAt: new Date(),
      })
      .returning();

    await service.changeLanguage(room.id, candidate.id, 'javascript');

    const [untouched] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, finishedSession!.id));
    expect(untouched!.language).toBe('python');
    expect(untouched!.status).toBe('finished');
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
      expect.objectContaining({
        roomId: room.id,
        initialContentByLanguage: { python: '# starter', javascript: '// starter' },
      }),
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
