import {
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { COLLAB_CLIENT, EXECUTION_CLIENT } from '@syncode/contracts';
import { MEDIA_SERVICE } from '@syncode/shared/ports';
import { DB_CLIENT } from '@/modules/db/db.module';
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

  return {
    db: { insert: mockInsert, select: mockSelect },
    mocks: { mockReturning, mockSelect },
  };
}

describe('RoomsService', () => {
  let service: RoomsService;
  let dbSetup: ReturnType<typeof createMockDb>;
  let mockCollabClient: Record<string, ReturnType<typeof vi.fn>>;
  let mockMediaService: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    dbSetup = createMockDb();

    mockCollabClient = {
      createDocument: vi.fn().mockResolvedValue({ roomId: ROOM_ROW.id, createdAt: Date.now() }),
      destroyDocument: vi.fn().mockResolvedValue({ roomId: ROOM_ROW.id, finalSnapshot: undefined }),
      kickUser: vi.fn(),
      healthCheck: vi.fn(),
    };

    mockMediaService = {
      createRoom: vi.fn().mockResolvedValue(undefined),
      deleteRoom: vi.fn().mockResolvedValue(undefined),
      listRooms: vi.fn(),
      getRoomInfo: vi.fn(),
      generateToken: vi.fn(),
      removeParticipant: vi.fn(),
      muteParticipantTrack: vi.fn(),
      updateParticipantPermissions: vi.fn(),
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        RoomsService,
        { provide: DB_CLIENT, useValue: dbSetup.db },
        {
          provide: EXECUTION_CLIENT,
          useValue: { submit: vi.fn().mockResolvedValue({ jobId: 'job-123' }) },
        },
        { provide: COLLAB_CLIENT, useValue: mockCollabClient },
        { provide: MEDIA_SERVICE, useValue: mockMediaService },
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

  describe('getRoom', () => {
    it('GIVEN non-existent room WHEN getting details THEN throws NotFoundException', async () => {
      dbSetup.mocks.mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(service.getRoom('nonexistent', HOST_ID)).rejects.toThrow(NotFoundException);
    });

    it('GIVEN user not a participant WHEN getting details THEN throws ForbiddenException', async () => {
      const mockWhere = vi
        .fn()
        .mockResolvedValueOnce([ROOM_ROW]) // room exists
        .mockResolvedValueOnce([]); // no participants with this userId

      dbSetup.mocks.mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: mockWhere,
          innerJoin: vi.fn().mockReturnValue({ where: mockWhere }),
        }),
      });

      await expect(service.getRoom(ROOM_ROW.id, 'stranger')).rejects.toThrow(ForbiddenException);
    });

    it('GIVEN valid participant WHEN getting details THEN returns room with role and all 20 host capabilities', async () => {
      const participantRow = {
        userId: HOST_ID,
        username: 'testuser',
        displayName: 'Test',
        avatarUrl: null,
        role: 'host',
        isActive: true,
        joinedAt: new Date('2026-04-02T00:00:00Z'),
      };

      const mockWhere = vi
        .fn()
        .mockResolvedValueOnce([ROOM_ROW])
        .mockResolvedValueOnce([participantRow]);

      dbSetup.mocks.mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: mockWhere,
          innerJoin: vi.fn().mockReturnValue({ where: mockWhere }),
        }),
      });

      const result = await service.getRoom(ROOM_ROW.id, HOST_ID);

      expect(result.roomId).toBe(ROOM_ROW.id);
      expect(result.myRole).toBe('host');
      expect(result.myCapabilities).toHaveLength(20);
      expect(result.myCapabilities).toContain('code:edit');
      expect(result.myCapabilities).toContain('participant:kick');
      expect(result.participants).toEqual([participantRow]);
      expect(result.config).toEqual({
        maxParticipants: 2,
        maxDuration: 120,
        isPrivate: true,
      });
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
