import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AI_CLIENT, COLLAB_CLIENT } from '@syncode/contracts';
import {
  AGENT_DISPATCH_SERVICE,
  CACHE_SERVICE,
  MEDIA_SERVICE,
  STORAGE_SERVICE,
} from '@syncode/shared/ports';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import { ExecutionService } from '@/modules/execution/execution.service.js';
import { SessionReportsService } from '@/modules/sessions/session-reports.service.js';
import { InMemoryCacheService } from '@/test/in-memory-cache.service.js';
import {
  createMockAgentDispatchService,
  createMockAiClient,
  createMockCollabClient,
  createMockConfigService,
  createMockJwtService,
  createMockMediaService,
  createMockSessionReportsService,
  createMockStorageService,
} from '@/test/mock-factories.js';
import { RoomsService } from './rooms.service.js';

const ROOM_ROW = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  hostId: '11111111-2222-3333-4444-555555555555',
  name: null,
  mode: 'peer' as const,
  status: 'waiting' as const,
  language: null,
  problemId: null,
  inviteCode: 'A3K7M2',
  maxParticipants: 2,
  maxDuration: 120,
  isPrivate: true,
  editorLocked: false,
  timerPaused: false,
  elapsedMs: 0,
  createdAt: new Date('2026-04-02T00:00:00Z'),
  updatedAt: new Date('2026-04-02T00:00:00Z'),
  phaseStartedAt: null,
  endedAt: null,
};

const HOST_ID = ROOM_ROW.hostId;

const CREATE_INPUT = {
  mode: 'peer' as const,
  config: { maxParticipants: 2, maxDuration: 120, isPrivate: true },
};

/**
 * NOTE: listRooms uses complex Drizzle joins + correlated subqueries
 * that are impractical to mock at the unit level. Cover with integration tests.
 */
function createMockDb() {
  const mockReturning = vi.fn().mockResolvedValue([ROOM_ROW]);
  const mockOnConflict = vi.fn().mockReturnValue({ returning: mockReturning });
  const mockValues = vi.fn().mockReturnValue({
    returning: mockReturning,
    onConflictDoNothing: mockOnConflict,
  });
  const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

  const mockSelectLimit = vi.fn().mockResolvedValue([]);
  const mockSelectWhere = vi.fn().mockImplementation(() => {
    const thenable = Promise.resolve([]) as Promise<unknown[]> & {
      limit: typeof mockSelectLimit;
    };
    thenable.limit = mockSelectLimit;
    return thenable;
  });
  const mockSelectInnerJoin = vi.fn().mockReturnValue({ where: mockSelectWhere });
  const mockSelectFrom = vi.fn().mockReturnValue({
    where: mockSelectWhere,
    innerJoin: mockSelectInnerJoin,
  });
  const mockSelect = vi.fn().mockReturnValue({ from: mockSelectFrom });

  const mockTransaction = vi
    .fn()
    .mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      return cb({ insert: mockInsert });
    });

  return {
    db: { insert: mockInsert, select: mockSelect, transaction: mockTransaction },
    mocks: { mockReturning, mockSelect, mockSelectWhere },
  };
}

describe('RoomsService', () => {
  let service: RoomsService;
  let dbSetup: ReturnType<typeof createMockDb>;
  let mockAiClient: ReturnType<typeof createMockAiClient>;
  let mockCollabClient: ReturnType<typeof createMockCollabClient>;
  let mockMediaService: ReturnType<typeof createMockMediaService>;
  let mockAgentDispatchService: ReturnType<typeof createMockAgentDispatchService>;
  let mockConfigService: ReturnType<typeof createMockConfigService>;
  let cacheService: InMemoryCacheService;

  beforeEach(async () => {
    dbSetup = createMockDb();
    mockAiClient = createMockAiClient();
    mockCollabClient = createMockCollabClient();
    mockMediaService = createMockMediaService();
    mockAgentDispatchService = createMockAgentDispatchService();
    mockConfigService = createMockConfigService({ AI_INTERVIEWER_LIVEKIT_ENABLED: true });
    cacheService = new InMemoryCacheService();

    const module = await Test.createTestingModule({
      providers: [
        RoomsService,
        { provide: DB_CLIENT, useValue: dbSetup.db },
        { provide: ExecutionService, useValue: { runCode: vi.fn(), submitProblem: vi.fn() } },
        { provide: AI_CLIENT, useValue: mockAiClient },
        { provide: COLLAB_CLIENT, useValue: mockCollabClient },
        { provide: MEDIA_SERVICE, useValue: mockMediaService },
        { provide: AGENT_DISPATCH_SERVICE, useValue: mockAgentDispatchService },
        { provide: STORAGE_SERVICE, useValue: createMockStorageService() },
        { provide: CACHE_SERVICE, useValue: cacheService },
        { provide: JwtService, useValue: createMockJwtService('mock-collab-token') },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: SessionReportsService, useValue: createMockSessionReportsService() },
      ],
    }).compile();

    service = module.get(RoomsService);
  });

  describe('createRoom', () => {
    it('GIVEN valid input WHEN creating room THEN returns complete response with subsystem status', async () => {
      const result = await service.createRoom(HOST_ID, CREATE_INPUT);

      expect(result).toEqual({
        roomId: ROOM_ROW.id,
        roomCode: ROOM_ROW.inviteCode,
        name: null,
        status: 'waiting',
        mode: 'peer',
        hostId: HOST_ID,
        problemId: null,
        language: null,
        config: { maxParticipants: 2, maxDuration: 120, isPrivate: true },
        createdAt: new Date('2026-04-02T00:00:00Z'),
        collabCreated: true,
        mediaCreated: true,
      });
    });

    it('GIVEN subsystem failure WHEN creating room THEN succeeds with degraded status flags', async () => {
      mockCollabClient.createDocument.mockRejectedValue(new Error('collab down'));
      mockMediaService.createRoom.mockRejectedValue(new Error('livekit down'));

      const result = await service.createRoom(HOST_ID, CREATE_INPUT);

      expect(result.roomId).toBe(ROOM_ROW.id);
      expect(result.collabCreated).toBe(false);
      expect(result.mediaCreated).toBe(false);
    });

    it('GIVEN invite code collision WHEN inserting THEN retries and succeeds', async () => {
      dbSetup.mocks.mockReturning.mockResolvedValueOnce([]).mockResolvedValueOnce([ROOM_ROW]);

      const result = await service.createRoom(HOST_ID, CREATE_INPUT);

      expect(result.roomId).toBe(ROOM_ROW.id);
    });

    // Starter code tests (with/without problemId) live in integration tests
    // because they involve multi-table DB queries that are fragile to mock
    // with sequence-dependent mockReturnValueOnce chains.

    it('GIVEN persistent collisions WHEN max retries exceeded THEN throws 500', async () => {
      dbSetup.mocks.mockReturning.mockResolvedValue([]);

      await expect(service.createRoom(HOST_ID, CREATE_INPUT)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('GIVEN DB connection error WHEN inserting THEN propagates error', async () => {
      dbSetup.mocks.mockReturning.mockRejectedValue(new Error('connection lost'));

      await expect(service.createRoom(HOST_ID, CREATE_INPUT)).rejects.toThrow('connection lost');
    });
  });

  describe('destroyRoom', () => {
    it('GIVEN subsystem failures WHEN destroying THEN succeeds with degraded status', async () => {
      const txSelectWhere = vi.fn().mockReturnValue({
        for: vi.fn().mockResolvedValue([ROOM_ROW]),
      });
      const txSessionWhere = vi.fn().mockResolvedValue([]);
      const txDeleteWhere = vi.fn().mockResolvedValue(undefined);

      dbSetup.db.transaction = vi.fn().mockImplementation(async (cb) =>
        cb({
          select: vi
            .fn()
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({ where: txSelectWhere }),
            })
            .mockReturnValue({
              from: vi.fn().mockReturnValue({ where: txSessionWhere }),
            }),
          delete: vi.fn().mockReturnValue({
            where: txDeleteWhere,
          }),
        }),
      );
      mockCollabClient.destroyDocument.mockRejectedValue(new Error('down'));

      const result = await service.destroyRoom(ROOM_ROW.id, HOST_ID);

      expect(result.collab).toBeNull();
      expect(result.mediaDeleted).toBe(true);
    });
  });

  describe('generateMediaToken', () => {
    function mockAiRoomContext() {
      dbSetup.mocks.mockSelectWhere
        .mockResolvedValueOnce([{ ...ROOM_ROW, mode: 'ai' as const }])
        .mockResolvedValueOnce([{ userId: HOST_ID, role: 'candidate', isActive: true }]);
      mockMediaService.generateToken.mockResolvedValue({
        token: 'media-token',
        url: 'ws://localhost:7880',
      });
    }

    it('GIVEN recently created AI interviewer dispatch without active agent WHEN generating media token THEN reuses it', async () => {
      mockAiRoomContext();
      await cacheService.set(`ai-interviewer-dispatch:${ROOM_ROW.id}`, 'starting-dispatch-id');
      await cacheService.set(`ai-interviewer-dispatch-started-at:${ROOM_ROW.id}`, Date.now());
      mockAgentDispatchService.listDispatch.mockResolvedValueOnce([
        {
          dispatchId: 'starting-dispatch-id',
          roomName: ROOM_ROW.id,
          agentName: 'syncode-ai-interviewer',
        },
      ]);

      await service.generateMediaToken(ROOM_ROW.id, HOST_ID);

      expect(mockMediaService.listParticipants).not.toHaveBeenCalled();
      expect(mockAgentDispatchService.deleteDispatch).not.toHaveBeenCalled();
      expect(mockAgentDispatchService.createDispatch).not.toHaveBeenCalled();
      expect(await cacheService.get(`ai-interviewer-dispatch:${ROOM_ROW.id}`)).toBe(
        'starting-dispatch-id',
      );
    });

    it('GIVEN recovery refresh during AI interviewer startup grace WHEN generating media token THEN preserves the in-flight dispatch', async () => {
      mockAiRoomContext();
      await cacheService.set(`ai-interviewer-dispatch:${ROOM_ROW.id}`, 'pending-dispatch-id');
      await cacheService.set(`ai-interviewer-dispatch-started-at:${ROOM_ROW.id}`, Date.now());
      mockAgentDispatchService.listDispatch.mockResolvedValueOnce([
        {
          dispatchId: 'pending-dispatch-id',
          roomName: ROOM_ROW.id,
          agentName: 'syncode-ai-interviewer',
          jobs: [{ id: 'job-1', status: 'pending' }],
        },
      ]);

      await service.generateMediaToken(ROOM_ROW.id, HOST_ID, {
        recoverAiInterviewerDispatch: true,
      });

      expect(mockMediaService.listParticipants).not.toHaveBeenCalled();
      expect(mockAgentDispatchService.deleteDispatch).not.toHaveBeenCalled();
      expect(mockAgentDispatchService.createDispatch).not.toHaveBeenCalled();
      expect(await cacheService.get(`ai-interviewer-dispatch:${ROOM_ROW.id}`)).toBe(
        'pending-dispatch-id',
      );
    });

    it('GIVEN recovery refresh after reconnect grace with running AI interviewer job WHEN generating media token THEN replaces it', async () => {
      mockAiRoomContext();
      await cacheService.set(`ai-interviewer-dispatch:${ROOM_ROW.id}`, 'running-dispatch-id');
      await cacheService.set(
        `ai-interviewer-dispatch-started-at:${ROOM_ROW.id}`,
        Date.now() - 45_000,
      );
      mockAgentDispatchService.listDispatch.mockResolvedValueOnce([
        {
          dispatchId: 'running-dispatch-id',
          roomName: ROOM_ROW.id,
          agentName: 'syncode-ai-interviewer',
          jobs: [{ id: 'job-1', status: 'running' }],
        },
      ]);
      mockAgentDispatchService.createDispatch.mockResolvedValueOnce({
        dispatchId: 'replacement-dispatch-id',
        roomName: ROOM_ROW.id,
        agentName: 'syncode-ai-interviewer',
      });

      await service.generateMediaToken(ROOM_ROW.id, HOST_ID, {
        recoverAiInterviewerDispatch: true,
      });

      expect(mockAgentDispatchService.deleteDispatch).toHaveBeenCalledWith(
        'running-dispatch-id',
        ROOM_ROW.id,
      );
      expect(mockAgentDispatchService.createDispatch).toHaveBeenCalled();
      expect(await cacheService.get(`ai-interviewer-dispatch:${ROOM_ROW.id}`)).toBe(
        'replacement-dispatch-id',
      );
    });

    it('GIVEN stale running AI interviewer dispatch without active agent WHEN generating media token THEN replaces it', async () => {
      mockAiRoomContext();
      await cacheService.set(`ai-interviewer-dispatch:${ROOM_ROW.id}`, 'stale-running-dispatch-id');
      await cacheService.set(
        `ai-interviewer-dispatch-started-at:${ROOM_ROW.id}`,
        Date.now() - 120_000,
      );
      mockAgentDispatchService.listDispatch.mockResolvedValueOnce([
        {
          dispatchId: 'stale-running-dispatch-id',
          roomName: ROOM_ROW.id,
          agentName: 'syncode-ai-interviewer',
          jobs: [{ id: 'job-1', status: 'running' }],
        },
      ]);
      mockMediaService.listParticipants.mockResolvedValueOnce([]);
      mockAgentDispatchService.createDispatch.mockResolvedValueOnce({
        dispatchId: 'replacement-dispatch-id',
        roomName: ROOM_ROW.id,
        agentName: 'syncode-ai-interviewer',
      });

      await service.generateMediaToken(ROOM_ROW.id, HOST_ID);

      expect(mockMediaService.listParticipants).toHaveBeenCalledWith(ROOM_ROW.id);
      expect(mockAgentDispatchService.deleteDispatch).toHaveBeenCalledWith(
        'stale-running-dispatch-id',
        ROOM_ROW.id,
      );
      expect(mockAgentDispatchService.createDispatch).toHaveBeenCalled();
      expect(await cacheService.get(`ai-interviewer-dispatch:${ROOM_ROW.id}`)).toBe(
        'replacement-dispatch-id',
      );
    });

    it('GIVEN recovery refresh after reconnect grace with empty AI interviewer job state WHEN generating media token THEN replaces it', async () => {
      mockAiRoomContext();
      await cacheService.set(`ai-interviewer-dispatch:${ROOM_ROW.id}`, 'slow-dispatch-id');
      await cacheService.set(
        `ai-interviewer-dispatch-started-at:${ROOM_ROW.id}`,
        Date.now() - 45_000,
      );
      mockAgentDispatchService.listDispatch.mockResolvedValueOnce([
        {
          dispatchId: 'slow-dispatch-id',
          roomName: ROOM_ROW.id,
          agentName: 'syncode-ai-interviewer',
        },
      ]);
      mockAgentDispatchService.createDispatch.mockResolvedValueOnce({
        dispatchId: 'replacement-dispatch-id',
        roomName: ROOM_ROW.id,
        agentName: 'syncode-ai-interviewer',
      });

      await service.generateMediaToken(ROOM_ROW.id, HOST_ID, {
        recoverAiInterviewerDispatch: true,
      });

      expect(mockAgentDispatchService.deleteDispatch).toHaveBeenCalledWith(
        'slow-dispatch-id',
        ROOM_ROW.id,
      );
      expect(mockAgentDispatchService.createDispatch).toHaveBeenCalled();
      expect(await cacheService.get(`ai-interviewer-dispatch:${ROOM_ROW.id}`)).toBe(
        'replacement-dispatch-id',
      );
    });

    it('GIVEN cached terminal dispatch and newer in-flight dispatch WHEN generating media token THEN preserves the in-flight dispatch', async () => {
      mockAiRoomContext();
      await cacheService.set(`ai-interviewer-dispatch:${ROOM_ROW.id}`, 'terminal-dispatch-id');
      await cacheService.set(`ai-interviewer-dispatch-started-at:${ROOM_ROW.id}`, Date.now());
      mockAgentDispatchService.listDispatch.mockResolvedValueOnce([
        {
          dispatchId: 'terminal-dispatch-id',
          roomName: ROOM_ROW.id,
          agentName: 'syncode-ai-interviewer',
          jobs: [{ id: 'job-1', status: 'failed' }],
        },
        {
          dispatchId: 'pending-dispatch-id',
          roomName: ROOM_ROW.id,
          agentName: 'syncode-ai-interviewer',
          jobs: [{ id: 'job-2', status: 'pending' }],
        },
      ]);

      await service.generateMediaToken(ROOM_ROW.id, HOST_ID);

      expect(mockMediaService.listParticipants).not.toHaveBeenCalled();
      expect(mockAgentDispatchService.deleteDispatch).not.toHaveBeenCalled();
      expect(mockAgentDispatchService.createDispatch).not.toHaveBeenCalled();
      expect(await cacheService.get(`ai-interviewer-dispatch:${ROOM_ROW.id}`)).toBe(
        'pending-dispatch-id',
      );
    });
  });

  describe('generateAiInterviewerSimliAvatarSession', () => {
    function mockAiRoomContext() {
      dbSetup.mocks.mockSelectWhere
        .mockResolvedValueOnce([{ ...ROOM_ROW, mode: 'ai' as const }])
        .mockResolvedValueOnce([{ userId: HOST_ID, role: 'candidate', isActive: true }]);
    }

    it('GIVEN Simli is not configured WHEN creating an avatar session THEN returns disabled', async () => {
      mockAiRoomContext();
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const result = await service.generateAiInterviewerSimliAvatarSession(ROOM_ROW.id, HOST_ID);

      expect(result).toEqual({ enabled: false });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('GIVEN Simli is configured WHEN creating an avatar session THEN calls compose token API server-side', async () => {
      mockAiRoomContext();
      mockConfigService.get.mockImplementation((key: string) => {
        const values: Record<string, unknown> = {
          SIMLI_API_KEY: 'simli-key',
          SIMLI_API_BASE_URL: 'https://api.simli.ai',
          SIMLI_WS_BASE_URL: 'wss://api.simli.ai',
          SIMLI_FACE_ID: 'face-1',
          SIMLI_MAX_SESSION_LENGTH_SECONDS: 900,
          SIMLI_MAX_IDLE_SECONDS: 120,
          SIMLI_MODEL: 'fasttalk',
          SIMLI_AUDIO_BUFFER_SIZE: 4096,
        };
        return values[key];
      });
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ session_token: 'simli-session-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      mockMediaService.generateToken.mockResolvedValueOnce({
        token: 'avatar-livekit-token',
        url: 'ws://localhost:7880',
      });

      const result = await service.generateAiInterviewerSimliAvatarSession(ROOM_ROW.id, HOST_ID);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.simli.ai/compose/token');
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual({
        'Content-Type': 'application/json',
        'x-simli-api-key': 'simli-key',
      });
      expect(JSON.parse(init.body as string)).toEqual({
        faceId: 'face-1',
        handleSilence: false,
        maxSessionLength: 900,
        maxIdleTime: 120,
        model: 'fasttalk',
      });
      expect(result).toEqual({
        enabled: true,
        sessionToken: 'simli-session-token',
        wsUrl: 'wss://api.simli.ai',
        audioBufferSize: 4096,
        liveKitToken: 'avatar-livekit-token',
        liveKitUrl: 'ws://localhost:7880',
        avatarIdentity: 'ai-interviewer-avatar',
      });
      expect(mockMediaService.generateToken).toHaveBeenCalledWith({
        roomName: ROOM_ROW.id,
        participantIdentity: 'ai-interviewer-avatar',
        participantName: 'AI Interviewer Avatar',
        participantAttributes: {
          'lk.publish_on_behalf': 'ai-interviewer',
        },
        canPublish: true,
        canSubscribe: false,
        ttlSeconds: 14400,
      });
    });
  });
});
