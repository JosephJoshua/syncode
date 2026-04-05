import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { COLLAB_CLIENT, EXECUTION_CLIENT } from '@syncode/contracts';
import { MEDIA_SERVICE } from '@syncode/shared/ports';
import { DB_CLIENT } from '@/modules/db/db.module';
import {
  createMockCollabClient,
  createMockConfigService,
  createMockExecutionClient,
  createMockJwtService,
  createMockMediaService,
} from '@/test/mock-factories';
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

  const mockSelectWhere = vi.fn().mockResolvedValue([]);
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
    mocks: { mockReturning, mockSelect },
  };
}

describe('RoomsService', () => {
  let service: RoomsService;
  let dbSetup: ReturnType<typeof createMockDb>;
  let mockCollabClient: ReturnType<typeof createMockCollabClient>;
  let mockMediaService: ReturnType<typeof createMockMediaService>;

  beforeEach(async () => {
    dbSetup = createMockDb();
    mockCollabClient = createMockCollabClient();
    mockMediaService = createMockMediaService();

    const module = await Test.createTestingModule({
      providers: [
        RoomsService,
        { provide: DB_CLIENT, useValue: dbSetup.db },
        { provide: EXECUTION_CLIENT, useValue: createMockExecutionClient() },
        { provide: COLLAB_CLIENT, useValue: mockCollabClient },
        { provide: MEDIA_SERVICE, useValue: mockMediaService },
        { provide: JwtService, useValue: createMockJwtService('mock-collab-token') },
        { provide: ConfigService, useValue: createMockConfigService() },
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

  describe('joinRoom', () => {
    const JOINING_USER_ID = '22222222-3333-4444-5555-666666666666';
    const JOIN_INPUT = { roomCode: 'A3K7M2' };

    it('GIVEN non-existent room WHEN joining THEN throws NotFoundException', async () => {
      dbSetup.mocks.mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
      });

      await expect(service.joinRoom('nonexistent', JOINING_USER_ID, JOIN_INPUT)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('GIVEN wrong invite code WHEN joining THEN throws BadRequestException', async () => {
      dbSetup.mocks.mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([ROOM_ROW]),
        }),
      });

      await expect(
        service.joinRoom(ROOM_ROW.id, JOINING_USER_ID, { roomCode: 'WRONG1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('GIVEN finished room WHEN joining THEN throws ConflictException', async () => {
      dbSetup.mocks.mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ ...ROOM_ROW, status: 'finished' }]),
        }),
      });

      await expect(service.joinRoom(ROOM_ROW.id, JOINING_USER_ID, JOIN_INPUT)).rejects.toThrow(
        ConflictException,
      );
    });

    it('GIVEN user already active in room WHEN joining THEN throws ConflictException', async () => {
      dbSetup.mocks.mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([ROOM_ROW]),
        }),
      });

      const txSelectWhere = vi
        .fn()
        .mockResolvedValue([{ id: 'p-1', userId: JOINING_USER_ID, isActive: true }]);

      dbSetup.db.transaction = vi.fn().mockImplementation(async (cb) =>
        cb({
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({ where: txSelectWhere }),
          }),
        }),
      );

      await expect(service.joinRoom(ROOM_ROW.id, JOINING_USER_ID, JOIN_INPUT)).rejects.toThrow(
        ConflictException,
      );
    });

    it('GIVEN room at max capacity WHEN joining THEN throws ConflictException', async () => {
      dbSetup.mocks.mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ ...ROOM_ROW, maxParticipants: 2 }]),
        }),
      });

      const txSelectWhere = vi.fn().mockResolvedValue([
        { id: 'p-1', userId: HOST_ID, isActive: true },
        { id: 'p-2', userId: 'other-user', isActive: true },
      ]);

      dbSetup.db.transaction = vi.fn().mockImplementation(async (cb) =>
        cb({
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({ where: txSelectWhere }),
          }),
        }),
      );

      await expect(service.joinRoom(ROOM_ROW.id, JOINING_USER_ID, JOIN_INPUT)).rejects.toThrow(
        ConflictException,
      );
    });

    it('GIVEN valid input WHEN joining THEN inserts participant and returns room detail with collab credentials', async () => {
      const participantRow = {
        userId: JOINING_USER_ID,
        username: 'joiner',
        displayName: 'Joiner',
        avatarUrl: null,
        role: 'candidate',
        isActive: true,
        joinedAt: new Date('2026-04-02T01:00:00Z'),
      };

      dbSetup.mocks.mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([ROOM_ROW]),
        }),
      });

      const txInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
      });
      dbSetup.db.transaction = vi.fn().mockImplementation(async (cb) =>
        cb({
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          }),
          insert: txInsert,
        }),
      );

      dbSetup.mocks.mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([participantRow]),
          }),
        }),
      });

      const result = await service.joinRoom(ROOM_ROW.id, JOINING_USER_ID, JOIN_INPUT);

      expect(result.assignedRole).toBe('candidate');
      expect(result.collabToken).toBe('mock-collab-token');
      expect(result.collabUrl).toBe('http://localhost:3001');
      expect(result.myCapabilities.length).toBeGreaterThan(0);
      expect(result.room.roomId).toBe(ROOM_ROW.id);
    });

    it('GIVEN preferred role WHEN joining THEN assigns requested role', async () => {
      const participantRow = {
        userId: JOINING_USER_ID,
        username: 'joiner',
        displayName: 'Joiner',
        avatarUrl: null,
        role: 'spectator',
        isActive: true,
        joinedAt: new Date('2026-04-02T01:00:00Z'),
      };

      dbSetup.mocks.mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([ROOM_ROW]),
        }),
      });

      dbSetup.db.transaction = vi.fn().mockImplementation(async (cb) =>
        cb({
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
          }),
        }),
      );

      dbSetup.mocks.mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([participantRow]),
          }),
        }),
      });

      const result = await service.joinRoom(ROOM_ROW.id, JOINING_USER_ID, {
        roomCode: 'A3K7M2',
        preferredRole: 'spectator',
      });

      expect(result.assignedRole).toBe('spectator');
    });

    it('GIVEN inactive participant WHEN rejoining THEN updates existing row', async () => {
      const existingInactive = {
        id: 'p-existing',
        userId: JOINING_USER_ID,
        isActive: false,
      };

      const participantRow = {
        userId: JOINING_USER_ID,
        username: 'joiner',
        displayName: 'Joiner',
        avatarUrl: null,
        role: 'candidate',
        isActive: true,
        joinedAt: new Date('2026-04-02T01:00:00Z'),
      };

      dbSetup.mocks.mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([ROOM_ROW]),
        }),
      });

      const txUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      });

      dbSetup.db.transaction = vi.fn().mockImplementation(async (cb) =>
        cb({
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([existingInactive]),
            }),
          }),
          update: txUpdate,
        }),
      );

      dbSetup.mocks.mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([participantRow]),
          }),
        }),
      });

      const result = await service.joinRoom(ROOM_ROW.id, JOINING_USER_ID, JOIN_INPUT);

      expect(result.assignedRole).toBe('candidate');
      expect(result.room.roomId).toBe(ROOM_ROW.id);
    });
  });

  describe('destroyRoom', () => {
    it('GIVEN subsystem failures WHEN destroying THEN succeeds with degraded status', async () => {
      mockCollabClient.destroyDocument.mockRejectedValue(new Error('down'));

      const result = await service.destroyRoom('room-1');

      expect(result.collab).toBeNull();
      expect(result.mediaDeleted).toBe(true);
    });
  });
});
