import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AI_CLIENT, COLLAB_CLIENT, EXECUTION_CLIENT } from '@syncode/contracts';
import type { Database } from '@syncode/db';
import { matchRequests, problemTags, roomParticipants, rooms, tags } from '@syncode/db';
import {
  AGENT_DISPATCH_SERVICE,
  CACHE_SERVICE,
  MEDIA_SERVICE,
  QUEUE_SERVICE,
  STORAGE_SERVICE,
} from '@syncode/shared/ports';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import { ExecutionService } from '@/modules/execution/execution.service.js';
import { RoomsService } from '@/modules/rooms/rooms.service.js';
import { SessionReportsService } from '@/modules/sessions/session-reports.service.js';
import { InMemoryCacheService } from '@/test/in-memory-cache.service.js';
import {
  createTestDb,
  insertParticipant,
  insertProblem,
  insertRoom,
  insertUser,
} from '@/test/integration-setup.js';
import {
  createMockAgentDispatchService,
  createMockAiClient,
  createMockCollabClient,
  createMockConfigService,
  createMockExecutionClient,
  createMockJwtService,
  createMockMediaService,
  createMockSessionReportsService,
  createMockStorageService,
} from '@/test/mock-factories.js';
import { MatchmakingService } from './matchmaking.service.js';

let db: Database;
let cleanup: () => Promise<void>;
let service: MatchmakingService;
let roomsService: RoomsService;

beforeEach(async () => {
  vi.clearAllMocks();

  const testDb = await createTestDb();
  db = testDb.db;
  cleanup = testDb.cleanup;

  const queueService = {
    enqueue: vi.fn().mockResolvedValue('matchmaking-job'),
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

  const module = await Test.createTestingModule({
    providers: [
      MatchmakingService,
      RoomsService,
      ExecutionService,
      { provide: DB_CLIENT, useValue: db },
      { provide: EXECUTION_CLIENT, useValue: createMockExecutionClient() },
      { provide: AI_CLIENT, useValue: createMockAiClient() },
      { provide: CACHE_SERVICE, useValue: new InMemoryCacheService() },
      { provide: COLLAB_CLIENT, useValue: createMockCollabClient() },
      { provide: MEDIA_SERVICE, useValue: createMockMediaService() },
      { provide: AGENT_DISPATCH_SERVICE, useValue: createMockAgentDispatchService() },
      { provide: STORAGE_SERVICE, useValue: createMockStorageService() },
      { provide: JwtService, useValue: createMockJwtService() },
      { provide: ConfigService, useValue: createMockConfigService() },
      { provide: SessionReportsService, useValue: createMockSessionReportsService() },
      { provide: QUEUE_SERVICE, useValue: queueService },
    ],
  }).compile();

  service = module.get(MatchmakingService);
  roomsService = module.get(RoomsService);
});

afterEach(async () => {
  await cleanup();
});

describe('MatchmakingService', () => {
  it('GIVEN two compatible queue requests WHEN entering queue THEN both users become matched in a new room', async () => {
    const firstUser = await insertUser(db);
    const secondUser = await insertUser(db);
    await insertProblem(db, { difficulty: 'easy', isPublished: true });

    const firstEnter = await service.enterQueue(firstUser.id, {
      languages: ['python'],
      difficulties: ['easy'],
      problemIds: [],
      topics: [],
      roles: [],
    });

    expect(firstEnter.status).toBe('searching');

    const secondEnter = await service.enterQueue(secondUser.id, {
      languages: ['python'],
      difficulties: ['easy'],
      problemIds: [],
      topics: [],
      roles: [],
    });

    expect(secondEnter.status).toBe('matched');
    if (secondEnter.status !== 'matched') {
      throw new Error('expected matched status');
    }

    const firstStatus = await service.getQueueStatus(firstUser.id);
    expect(firstStatus.status).toBe('matched');
    if (firstStatus.status !== 'matched') {
      throw new Error('expected matched status');
    }

    expect(firstStatus.roomId).toBe(secondEnter.roomId);
    expect(firstStatus.matchedWithUserId).toBe(secondUser.id);

    const [room] = await db.select().from(rooms).where(eq(rooms.id, firstStatus.roomId)).limit(1);
    expect(room).toBeDefined();
    expect(room?.hostId).toBe(firstUser.id);
    expect(room?.maxParticipants).toBe(5);

    const participants = await db
      .select({
        userId: roomParticipants.userId,
        role: roomParticipants.role,
        isActive: roomParticipants.isActive,
      })
      .from(roomParticipants)
      .where(eq(roomParticipants.roomId, firstStatus.roomId));

    expect(participants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: firstUser.id, role: 'interviewer', isActive: true }),
        expect.objectContaining({ userId: secondUser.id, role: 'candidate', isActive: true }),
      ]),
    );
  });

  it('GIVEN waiting public room has available slot WHEN queue preferences match THEN requester joins existing room', async () => {
    const host = await insertUser(db);
    const requester = await insertUser(db);
    const problem = await insertProblem(db, { difficulty: 'easy', isPublished: true });
    const room = await insertRoom(db, host.id, {
      status: 'waiting',
      isPrivate: false,
      language: 'python',
      problemId: problem.id,
      maxParticipants: 5,
    });
    await insertParticipant(db, room.id, host.id, 'interviewer');

    const result = await service.enterQueue(requester.id, {
      languages: ['python'],
      difficulties: ['easy'],
      problemIds: [problem.id],
      topics: [],
      roles: ['candidate'],
    });

    expect(result.status).toBe('matched');
    if (result.status !== 'matched') {
      throw new Error('expected matched status');
    }

    expect(result.roomId).toBe(room.id);
    expect(result.matchedWithUserId).toBe(host.id);

    const [participant] = await db
      .select({
        role: roomParticipants.role,
        isActive: roomParticipants.isActive,
      })
      .from(roomParticipants)
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, requester.id)))
      .limit(1);
    expect(participant?.isActive).toBe(true);
    expect(participant?.role).toBe('candidate');
  });

  it('GIVEN non-waiting public room WHEN requester queues THEN requester remains searching', async () => {
    const host = await insertUser(db);
    const activeCandidate = await insertUser(db);
    const requester = await insertUser(db);
    const room = await insertRoom(db, host.id, {
      status: 'coding',
      isPrivate: false,
      language: 'python',
      maxParticipants: 5,
    });
    await insertParticipant(db, room.id, host.id, 'interviewer');
    await insertParticipant(db, room.id, activeCandidate.id, 'candidate');

    const result = await service.enterQueue(requester.id, {
      languages: ['python'],
      difficulties: [],
      problemIds: [],
      topics: [],
      roles: ['candidate'],
    });

    expect(result.status).toBe('searching');

    const [participant] = await db
      .select({ role: roomParticipants.role })
      .from(roomParticipants)
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, requester.id)))
      .limit(1);
    expect(participant).toBeUndefined();
  });

  it('GIVEN only private room is available WHEN requester queues THEN requester remains searching', async () => {
    const host = await insertUser(db);
    const requester = await insertUser(db);
    const room = await insertRoom(db, host.id, {
      status: 'waiting',
      isPrivate: true,
      language: 'python',
      maxParticipants: 5,
    });
    await insertParticipant(db, room.id, host.id, 'interviewer');

    const result = await service.enterQueue(requester.id, {
      languages: ['python'],
      difficulties: [],
      problemIds: [],
      topics: [],
      roles: ['candidate'],
    });

    expect(result.status).toBe('searching');
  });

  it('GIVEN incompatible language preferences WHEN both users enter queue THEN both remain searching', async () => {
    const firstUser = await insertUser(db);
    const secondUser = await insertUser(db);

    await service.enterQueue(firstUser.id, {
      languages: ['python'],
      difficulties: [],
      problemIds: [],
      topics: [],
      roles: [],
    });

    await service.enterQueue(secondUser.id, {
      languages: ['javascript'],
      difficulties: [],
      problemIds: [],
      topics: [],
      roles: [],
    });

    const firstStatus = await service.getQueueStatus(firstUser.id);
    const secondStatus = await service.getQueueStatus(secondUser.id);

    expect(firstStatus.status).toBe('searching');
    expect(secondStatus.status).toBe('searching');
  });

  it('GIVEN first user prefers candidate and second prefers interviewer WHEN matched THEN second user becomes host interviewer', async () => {
    const firstUser = await insertUser(db);
    const secondUser = await insertUser(db);
    await insertProblem(db, { difficulty: 'easy', isPublished: true });

    await service.enterQueue(firstUser.id, {
      languages: ['python'],
      difficulties: ['easy'],
      problemIds: [],
      topics: [],
      roles: ['candidate'],
    });

    const secondEnter = await service.enterQueue(secondUser.id, {
      languages: ['python'],
      difficulties: ['easy'],
      problemIds: [],
      topics: [],
      roles: ['interviewer'],
    });

    expect(secondEnter.status).toBe('matched');
    if (secondEnter.status !== 'matched') {
      throw new Error('expected matched status');
    }

    const [room] = await db.select().from(rooms).where(eq(rooms.id, secondEnter.roomId)).limit(1);
    expect(room?.hostId).toBe(secondUser.id);

    const participants = await db
      .select({
        userId: roomParticipants.userId,
        role: roomParticipants.role,
      })
      .from(roomParticipants)
      .where(eq(roomParticipants.roomId, secondEnter.roomId));

    expect(participants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: secondUser.id, role: 'interviewer' }),
        expect.objectContaining({ userId: firstUser.id, role: 'candidate' }),
      ]),
    );
  });

  it('GIVEN observer-only role preferences WHEN both users queue THEN both remain searching', async () => {
    const firstUser = await insertUser(db);
    const secondUser = await insertUser(db);

    await service.enterQueue(firstUser.id, {
      languages: ['python'],
      difficulties: [],
      problemIds: [],
      topics: [],
      roles: ['observer'],
    });

    await service.enterQueue(secondUser.id, {
      languages: ['python'],
      difficulties: [],
      problemIds: [],
      topics: [],
      roles: ['observer'],
    });

    const firstStatus = await service.getQueueStatus(firstUser.id);
    const secondStatus = await service.getQueueStatus(secondUser.id);
    expect(firstStatus.status).toBe('searching');
    expect(secondStatus.status).toBe('searching');
  });

  it('GIVEN pending request WHEN polling status THEN queue position is returned and expiry is refreshed', async () => {
    const firstUser = await insertUser(db);
    const secondUser = await insertUser(db);

    const firstEnter = await service.enterQueue(firstUser.id, {
      languages: ['python'],
      difficulties: [],
      problemIds: [],
      topics: [],
      roles: ['observer'],
    });
    expect(firstEnter.status).toBe('searching');
    if (firstEnter.status !== 'searching') {
      throw new Error('expected searching status');
    }
    expect(firstEnter.queuePosition).toBe(1);

    await service.enterQueue(secondUser.id, {
      languages: ['python'],
      difficulties: [],
      problemIds: [],
      topics: [],
      roles: ['observer'],
    });

    const [beforeStatusPoll] = await db
      .select({ expiresAt: matchRequests.expiresAt })
      .from(matchRequests)
      .where(eq(matchRequests.id, firstEnter.requestId))
      .limit(1);

    const firstStatus = await service.getQueueStatus(firstUser.id);
    expect(firstStatus.status).toBe('searching');
    if (firstStatus.status !== 'searching') {
      throw new Error('expected searching status');
    }
    expect(firstStatus.queuePosition).toBe(1);

    const secondStatus = await service.getQueueStatus(secondUser.id);
    expect(secondStatus.status).toBe('searching');
    if (secondStatus.status !== 'searching') {
      throw new Error('expected searching status');
    }
    expect(secondStatus.queuePosition).toBe(2);

    const [afterStatusPoll] = await db
      .select({ expiresAt: matchRequests.expiresAt })
      .from(matchRequests)
      .where(eq(matchRequests.id, firstEnter.requestId))
      .limit(1);

    expect(beforeStatusPoll).toBeDefined();
    expect(afterStatusPoll).toBeDefined();
    expect(afterStatusPoll?.expiresAt.getTime() ?? 0).toBeGreaterThanOrEqual(
      beforeStatusPoll?.expiresAt.getTime() ?? 0,
    );
  });

  it('GIVEN topic preferences WHEN pairing users THEN matched room uses a problem with matching topic', async () => {
    const firstUser = await insertUser(db);
    const secondUser = await insertUser(db);
    const problem = await insertProblem(db, { difficulty: 'easy', isPublished: true });
    const [arrayTag] = await db.insert(tags).values({ name: 'Array', slug: 'array' }).returning();
    if (!arrayTag) {
      throw new Error('expected topic tag to be created');
    }
    await db.insert(problemTags).values({ problemId: problem.id, tagId: arrayTag.id });

    await service.enterQueue(firstUser.id, {
      languages: ['python'],
      difficulties: ['easy'],
      problemIds: [],
      topics: ['array'],
      roles: [],
    });

    const secondEnter = await service.enterQueue(secondUser.id, {
      languages: ['python'],
      difficulties: ['easy'],
      problemIds: [],
      topics: ['array'],
      roles: [],
    });

    expect(secondEnter.status).toBe('matched');
    if (secondEnter.status !== 'matched') {
      throw new Error('expected matched status');
    }

    const [room] = await db.select().from(rooms).where(eq(rooms.id, secondEnter.roomId)).limit(1);
    expect(room?.problemId).toBe(problem.id);
  });

  it('GIVEN both users provide overlapping problem preferences WHEN matched THEN selected problem is from overlap', async () => {
    const firstUser = await insertUser(db);
    const secondUser = await insertUser(db);
    const overlapProblemOne = await insertProblem(db, { difficulty: 'easy', isPublished: true });
    const overlapProblemTwo = await insertProblem(db, { difficulty: 'easy', isPublished: true });
    const firstOnlyProblem = await insertProblem(db, { difficulty: 'easy', isPublished: true });
    const secondOnlyProblem = await insertProblem(db, { difficulty: 'easy', isPublished: true });

    await service.enterQueue(firstUser.id, {
      languages: ['python'],
      difficulties: [],
      problemIds: [overlapProblemOne.id, overlapProblemTwo.id, firstOnlyProblem.id],
      topics: [],
      roles: [],
    });

    const secondEnter = await service.enterQueue(secondUser.id, {
      languages: ['python'],
      difficulties: [],
      problemIds: [overlapProblemOne.id, overlapProblemTwo.id, secondOnlyProblem.id],
      topics: [],
      roles: [],
    });

    expect(secondEnter.status).toBe('matched');
    if (secondEnter.status !== 'matched') {
      throw new Error('expected matched status');
    }

    const [room] = await db.select().from(rooms).where(eq(rooms.id, secondEnter.roomId)).limit(1);
    expect(room).toBeDefined();
    expect([overlapProblemOne.id, overlapProblemTwo.id]).toContain(room?.problemId);
  });

  it('GIVEN only one user provides problem preferences WHEN matched THEN selected problem comes from constrained user', async () => {
    const firstUser = await insertUser(db);
    const secondUser = await insertUser(db);
    const preferredProblemOne = await insertProblem(db, { difficulty: 'easy', isPublished: true });
    const preferredProblemTwo = await insertProblem(db, { difficulty: 'easy', isPublished: true });
    await insertProblem(db, { difficulty: 'easy', isPublished: true });

    await service.enterQueue(firstUser.id, {
      languages: ['python'],
      difficulties: [],
      problemIds: [preferredProblemOne.id, preferredProblemTwo.id],
      topics: [],
      roles: [],
    });

    const secondEnter = await service.enterQueue(secondUser.id, {
      languages: ['python'],
      difficulties: [],
      problemIds: [],
      topics: [],
      roles: [],
    });

    expect(secondEnter.status).toBe('matched');
    if (secondEnter.status !== 'matched') {
      throw new Error('expected matched status');
    }

    const [room] = await db.select().from(rooms).where(eq(rooms.id, secondEnter.roomId)).limit(1);
    expect(room).toBeDefined();
    expect([preferredProblemOne.id, preferredProblemTwo.id]).toContain(room?.problemId);
  });

  it('GIVEN active queue request WHEN user leaves queue THEN request is cancelled and status becomes idle', async () => {
    const user = await insertUser(db);

    await service.enterQueue(user.id, {
      languages: ['python'],
      difficulties: ['medium'],
      problemIds: [],
      topics: [],
      roles: [],
    });

    const leave = await service.leaveQueue(user.id);
    expect(leave).toEqual({ status: 'idle' });
    expect(await service.getQueueStatus(user.id)).toEqual({ status: 'idle' });

    const [row] = await db
      .select({ status: matchRequests.status })
      .from(matchRequests)
      .where(eq(matchRequests.userId, user.id))
      .orderBy(matchRequests.createdAt)
      .limit(1);

    expect(row?.status).toBe('cancelled');
  });

  it('GIVEN matched queue request WHEN user leaves queue THEN matched status is dismissed', async () => {
    const firstUser = await insertUser(db);
    const secondUser = await insertUser(db);

    await service.enterQueue(firstUser.id, {
      languages: ['python'],
      difficulties: [],
      problemIds: [],
      topics: [],
      roles: [],
    });
    await service.enterQueue(secondUser.id, {
      languages: ['python'],
      difficulties: [],
      problemIds: [],
      topics: [],
      roles: [],
    });

    expect((await service.getQueueStatus(firstUser.id)).status).toBe('matched');

    await expect(service.leaveQueue(firstUser.id)).resolves.toEqual({ status: 'idle' });
    expect(await service.getQueueStatus(firstUser.id)).toEqual({ status: 'idle' });
  });

  it('GIVEN concurrent enterQueue calls for one user WHEN both complete THEN only one pending request remains', async () => {
    const user = await insertUser(db);

    await Promise.all([
      service.enterQueue(user.id, {
        languages: ['python'],
        difficulties: [],
        problemIds: [],
        topics: [],
        roles: ['observer'],
      }),
      service.enterQueue(user.id, {
        languages: ['javascript'],
        difficulties: [],
        problemIds: [],
        topics: [],
        roles: ['observer'],
      }),
    ]);

    const activeRequests = await db
      .select({ id: matchRequests.id, status: matchRequests.status })
      .from(matchRequests)
      .where(and(eq(matchRequests.userId, user.id), eq(matchRequests.status, 'pending')));

    expect(activeRequests).toHaveLength(1);
  });

  it('GIVEN expired pending request WHEN running cycle THEN status becomes idle and request is marked expired', async () => {
    const user = await insertUser(db);
    const expiredAt = new Date(Date.now() - 30_000);

    await db.insert(matchRequests).values({
      userId: user.id,
      status: 'pending',
      expiresAt: expiredAt,
      requestedTags: {
        languages: ['python'],
        difficulties: [],
        problemIds: [],
        topics: [],
        roles: [],
      },
    });

    await service.runMatchingCycle();

    expect(await service.getQueueStatus(user.id)).toEqual({ status: 'idle' });

    const [row] = await db
      .select({ status: matchRequests.status })
      .from(matchRequests)
      .where(and(eq(matchRequests.userId, user.id), eq(matchRequests.expiresAt, expiredAt)))
      .limit(1);
    expect(row?.status).toBe('expired');
  });

  it('GIVEN request is cancelled after joining existing room WHEN cycle commits THEN join is rolled back', async () => {
    const host = await insertUser(db);
    const requester = await insertUser(db);
    const room = await insertRoom(db, host.id, {
      status: 'waiting',
      isPrivate: false,
      language: 'python',
      maxParticipants: 5,
    });
    await insertParticipant(db, room.id, host.id, 'interviewer');

    const expiresAt = new Date(Date.now() + 60_000);
    const [request] = await db
      .insert(matchRequests)
      .values({
        userId: requester.id,
        status: 'pending',
        expiresAt,
        requestedTags: {
          languages: ['python'],
          difficulties: [],
          problemIds: [],
          topics: [],
          roles: ['candidate'],
        },
      })
      .returning({ id: matchRequests.id });
    if (!request) {
      throw new Error('expected match request');
    }

    const originalJoinRoom = roomsService.joinRoom.bind(roomsService);
    vi.spyOn(roomsService, 'joinRoom').mockImplementation(async (...args) => {
      const result = await originalJoinRoom(...args);
      await db
        .update(matchRequests)
        .set({ status: 'cancelled' })
        .where(eq(matchRequests.id, request.id));
      return result;
    });

    await service.runMatchingCycle();

    const [requestRow] = await db
      .select({ status: matchRequests.status })
      .from(matchRequests)
      .where(eq(matchRequests.id, request.id))
      .limit(1);
    expect(requestRow?.status).toBe('cancelled');

    const [participant] = await db
      .select({ isActive: roomParticipants.isActive, leftAt: roomParticipants.leftAt })
      .from(roomParticipants)
      .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, requester.id)))
      .limit(1);
    expect(participant?.isActive).toBe(false);
    expect(participant?.leftAt).toBeInstanceOf(Date);
  });

  it('GIVEN request is cancelled after creating pair room WHEN cycle commits THEN room is removed', async () => {
    const firstUser = await insertUser(db);
    const secondUser = await insertUser(db);
    const expiresAt = new Date(Date.now() + 60_000);
    const sharedPreferences = {
      languages: ['python'],
      difficulties: [],
      problemIds: [],
      topics: [],
      roles: [],
    };

    const [firstRequest, secondRequest] = await db
      .insert(matchRequests)
      .values([
        {
          userId: firstUser.id,
          status: 'pending',
          expiresAt,
          requestedTags: sharedPreferences,
        },
        {
          userId: secondUser.id,
          status: 'pending',
          expiresAt,
          requestedTags: sharedPreferences,
        },
      ])
      .returning({ id: matchRequests.id, userId: matchRequests.userId });

    if (!firstRequest || !secondRequest) {
      throw new Error('expected match requests');
    }

    const originalJoinRoom = roomsService.joinRoom.bind(roomsService);
    vi.spyOn(roomsService, 'joinRoom').mockImplementation(async (...args) => {
      const result = await originalJoinRoom(...args);
      await db
        .update(matchRequests)
        .set({ status: 'cancelled' })
        .where(eq(matchRequests.id, secondRequest.id));
      return result;
    });

    await service.runMatchingCycle();

    const matchmadeRooms = await db
      .select({ id: rooms.id })
      .from(rooms)
      .where(eq(rooms.name, 'Matchmade Interview'));
    expect(matchmadeRooms).toHaveLength(0);

    const requestRows = await db
      .select({ id: matchRequests.id, status: matchRequests.status })
      .from(matchRequests)
      .where(eq(matchRequests.userId, secondUser.id));
    expect(requestRows).toEqual([
      expect.objectContaining({ id: secondRequest.id, status: 'cancelled' }),
    ]);
  });
});
