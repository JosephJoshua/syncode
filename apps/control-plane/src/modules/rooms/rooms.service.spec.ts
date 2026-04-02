import { InternalServerErrorException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { COLLAB_CLIENT, EXECUTION_CLIENT, type RunCodeRequest } from '@syncode/contracts';
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

function createMockDb() {
  const returningFn = vi.fn().mockResolvedValue([ROOM_ROW]);
  const onConflictDoNothingFn = vi.fn().mockReturnValue({ returning: returningFn });
  const valuesFn = vi.fn().mockReturnValue({ onConflictDoNothing: onConflictDoNothingFn });
  const insertFn = vi.fn().mockReturnValue({ values: valuesFn });

  return {
    db: { insert: insertFn },
    mocks: { returningFn },
  };
}

describe('RoomsService', () => {
  let service: RoomsService;
  let dbSetup: ReturnType<typeof createMockDb>;
  let mockCollabClient: Record<string, ReturnType<typeof vi.fn>>;
  let mockMediaService: Record<string, ReturnType<typeof vi.fn>>;
  let mockExecutionClient: Record<string, ReturnType<typeof vi.fn>>;

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

    mockExecutionClient = {
      submit: vi.fn().mockResolvedValue({ jobId: 'job-123' }),
    };

    const module = await Test.createTestingModule({
      providers: [
        RoomsService,
        { provide: DB_CLIENT, useValue: dbSetup.db },
        { provide: EXECUTION_CLIENT, useValue: mockExecutionClient },
        { provide: COLLAB_CLIENT, useValue: mockCollabClient },
        { provide: MEDIA_SERVICE, useValue: mockMediaService },
      ],
    }).compile();

    service = module.get(RoomsService);
  });

  describe('createRoom', () => {
    it('GIVEN valid input WHEN creating room THEN returns response matching API contract', async () => {
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

    it('GIVEN collab-plane down WHEN creating room THEN succeeds with collabCreated=false', async () => {
      mockCollabClient.createDocument.mockRejectedValue(new Error('collab down'));

      const result = await service.createRoom(HOST_ID, CREATE_INPUT);

      expect(result.roomId).toBe(ROOM_ROW.id);
      expect(result.collabCreated).toBe(false);
      expect(result.mediaCreated).toBe(true);
    });

    it('GIVEN media service down WHEN creating room THEN succeeds with mediaCreated=false', async () => {
      mockMediaService.createRoom.mockRejectedValue(new Error('livekit down'));

      const result = await service.createRoom(HOST_ID, CREATE_INPUT);

      expect(result.roomId).toBe(ROOM_ROW.id);
      expect(result.collabCreated).toBe(true);
      expect(result.mediaCreated).toBe(false);
    });

    it('GIVEN invite code collision WHEN inserting room THEN retries and creates room successfully', async () => {
      dbSetup.mocks.returningFn
        .mockResolvedValueOnce([]) // first attempt: collision, 0 rows
        .mockResolvedValueOnce([ROOM_ROW]); // second attempt: success

      const result = await service.createRoom(HOST_ID, CREATE_INPUT);

      expect(result.roomId).toBe(ROOM_ROW.id);
      expect(result.roomCode).toBe(ROOM_ROW.inviteCode);
    });

    it('GIVEN persistent collisions WHEN max retries exceeded THEN throws InternalServerErrorException', async () => {
      dbSetup.mocks.returningFn.mockResolvedValue([]); // always 0 rows

      await expect(service.createRoom(HOST_ID, CREATE_INPUT)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('GIVEN non-collision DB error WHEN inserting room THEN propagates error', async () => {
      dbSetup.mocks.returningFn.mockRejectedValue(new Error('connection lost'));

      await expect(service.createRoom(HOST_ID, CREATE_INPUT)).rejects.toThrow('connection lost');
    });
  });

  describe('destroyRoom', () => {
    it('GIVEN active room WHEN destroying THEN returns collab snapshot and media status', async () => {
      const result = await service.destroyRoom('room-1');

      expect(result.collab).toEqual({ roomId: ROOM_ROW.id, finalSnapshot: undefined });
      expect(result.mediaDeleted).toBe(true);
    });

    it('GIVEN collab-plane down WHEN destroying room THEN succeeds with null collab result', async () => {
      mockCollabClient.destroyDocument.mockRejectedValue(new Error('collab down'));

      const result = await service.destroyRoom('room-1');

      expect(result.collab).toBeNull();
      expect(result.mediaDeleted).toBe(true);
    });
  });

  describe('runCode', () => {
    it('GIVEN valid request WHEN running code THEN returns execution jobId', async () => {
      const request: RunCodeRequest = { language: 'python', code: 'print(1)' };
      const result = await service.runCode('room-1', request);

      expect(result).toEqual({ jobId: 'job-123' });
    });
  });
});
