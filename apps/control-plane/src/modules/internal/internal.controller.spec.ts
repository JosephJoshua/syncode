import { Test } from '@nestjs/testing';
import type {
  ParticipantHeartbeatRequest,
  SnapshotReadyPayload,
  UserDisconnectedPayload,
} from '@syncode/contracts';
import { STORAGE_SERVICE } from '@syncode/shared/ports';
import { describe, expect, it, vi } from 'vitest';
import { InternalCallbackGuard } from '@/common/guards/internal-callback.guard.js';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import { RoomsService } from '@/modules/rooms/rooms.service.js';
import { InternalController } from './internal.controller.js';

function createMocks() {
  return {
    roomsService: {
      markParticipantInactive: vi.fn().mockResolvedValue(undefined),
      recordParticipantHeartbeats: vi.fn().mockResolvedValue(0),
      persistDocSnapshot: vi.fn().mockResolvedValue(undefined),
      authorizeJoin: vi.fn().mockResolvedValue({ authorized: true }),
    },
    storageService: {
      upload: vi.fn().mockResolvedValue(undefined),
      download: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
    },
    db: {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
    },
  };
}

async function createController(mocks: ReturnType<typeof createMocks>) {
  const module = await Test.createTestingModule({
    controllers: [InternalController],
    providers: [
      { provide: RoomsService, useValue: mocks.roomsService },
      { provide: STORAGE_SERVICE, useValue: mocks.storageService },
      { provide: DB_CLIENT, useValue: mocks.db },
    ],
  })
    .overrideGuard(InternalCallbackGuard)
    .useValue({ canActivate: () => true })
    .compile();

  return module.get(InternalController);
}

describe('InternalController', () => {
  it('GIVEN valid snapshot payload WHEN handleSnapshotReady THEN uploads to correct S3 key with proper metadata and returns success true', async () => {
    const mocks = createMocks();
    mocks.db.limit.mockResolvedValueOnce([{ id: 'session-1', language: 'typescript' }]);
    const controller = await createController(mocks);

    const payload: SnapshotReadyPayload = {
      roomId: 'room-123',
      snapshot: [1, 2, 3],
      code: 'const x = 1;',
      language: 'python',
      timestamp: 1712500000000,
      trigger: 'periodic',
    };

    const result = await controller.handleSnapshotReady(payload);

    expect(result).toEqual({ success: true });
    expect(mocks.storageService.upload).toHaveBeenCalledOnce();

    const [key, body, options] = mocks.storageService.upload.mock.calls[0];
    expect(key).toBe(`snapshots/room-123/${payload.timestamp}.yjs`);
    expect(Buffer.isBuffer(body)).toBe(true);
    expect(options).toEqual({
      contentType: 'application/octet-stream',
      metadata: {
        roomId: 'room-123',
        timestamp: payload.timestamp.toString(),
      },
    });
  });

  it('GIVEN storage upload fails but db row can be written WHEN handleSnapshotReady THEN returns success true', async () => {
    const mocks = createMocks();
    mocks.db.limit.mockResolvedValueOnce([{ id: 'session-1', language: 'typescript' }]);
    mocks.storageService.upload.mockRejectedValue(new Error('S3 unavailable'));
    const controller = await createController(mocks);

    const payload: SnapshotReadyPayload = {
      roomId: 'room-456',
      snapshot: [4, 5, 6],
      code: 'let y = 2;',
      language: 'javascript',
      timestamp: 1712500001000,
      trigger: 'submission',
    };

    await expect(controller.handleSnapshotReady(payload)).resolves.toEqual({ success: true });
    expect(mocks.db.insert).toHaveBeenCalled();
  });

  it('GIVEN persistDocSnapshot fails WHEN handleSnapshotReady THEN throws because doc state is canonical', async () => {
    const mocks = createMocks();
    mocks.db.limit.mockResolvedValueOnce([{ id: 'session-1', language: 'typescript' }]);
    mocks.roomsService.persistDocSnapshot.mockRejectedValue(new Error('DB unavailable'));
    const controller = await createController(mocks);

    const payload: SnapshotReadyPayload = {
      roomId: 'room-456',
      snapshot: [4, 5, 6],
      code: 'let y = 2;',
      timestamp: 1712500001000,
      trigger: 'submission',
    };

    await expect(controller.handleSnapshotReady(payload)).rejects.toThrow(
      'Failed to store snapshot',
    );
  });

  it('GIVEN storage upload fails WHEN handleSnapshotReady THEN persists doc snapshot first then swallows the S3 error', async () => {
    const mocks = createMocks();
    mocks.db.limit.mockResolvedValueOnce([{ id: 'session-1', language: 'typescript' }]);
    mocks.storageService.upload.mockRejectedValue(new Error('S3 unavailable'));
    const controller = await createController(mocks);

    const payload: SnapshotReadyPayload = {
      roomId: 'room-456',
      snapshot: [4, 5, 6],
      code: 'let y = 2;',
      language: 'javascript',
      timestamp: 1712500001000,
      trigger: 'submission',
    };

    await expect(controller.handleSnapshotReady(payload)).resolves.toEqual({ success: true });
    expect(mocks.roomsService.persistDocSnapshot).toHaveBeenCalledWith(
      'room-456',
      expect.any(Uint8Array),
    );
  });

  it('GIVEN valid disconnect payload WHEN handleUserDisconnected THEN returns success', async () => {
    const mocks = createMocks();
    const controller = await createController(mocks);

    const payload: UserDisconnectedPayload = {
      roomId: 'room-789',
      userId: 'user-001',
      timestamp: 1712500002000,
    };

    const result = await controller.handleUserDisconnected(payload);

    expect(result).toEqual({ success: true });
  });

  it('GIVEN service failure WHEN handleUserDisconnected THEN returns success false', async () => {
    const mocks = createMocks();
    mocks.roomsService.markParticipantInactive.mockRejectedValueOnce(new Error('DB down'));
    const controller = await createController(mocks);

    const payload: UserDisconnectedPayload = {
      roomId: 'room-789',
      userId: 'user-001',
      timestamp: 1712500002000,
    };

    const result = await controller.handleUserDisconnected(payload);

    expect(result).toEqual({ success: false });
  });

  it('GIVEN payload language differs from session language WHEN handleSnapshotReady THEN persists the payload language (reflects mid-session switch)', async () => {
    const mocks = createMocks();
    // Session was started in typescript; user has since switched to python.
    mocks.db.limit.mockResolvedValueOnce([{ id: 'session-1', language: 'typescript' }]);
    const controller = await createController(mocks);

    const payload: SnapshotReadyPayload = {
      roomId: 'room-123',
      snapshot: [1, 2, 3],
      code: 'print(1)',
      language: 'python',
      timestamp: 1712500000000,
      trigger: 'periodic',
    };

    const result = await controller.handleSnapshotReady(payload);

    expect(result).toEqual({ success: true });
    expect(mocks.db.insert).toHaveBeenCalled();
    expect(mocks.db.values).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        roomId: 'room-123',
        code: 'print(1)',
        language: 'python',
        trigger: 'periodic',
      }),
    );
  });

  it('GIVEN heartbeat payload WHEN handleParticipantHeartbeat THEN delegates to rooms service and returns updated count', async () => {
    const mocks = createMocks();
    mocks.roomsService.recordParticipantHeartbeats.mockResolvedValueOnce(3);
    const controller = await createController(mocks);

    const payload: ParticipantHeartbeatRequest = {
      participants: [
        { roomId: 'room-1', userId: 'user-1' },
        { roomId: 'room-1', userId: 'user-2' },
        { roomId: 'room-2', userId: 'user-3' },
      ],
    };

    const result = await controller.handleParticipantHeartbeat(payload);

    expect(result).toEqual({ updated: 3 });
    expect(mocks.roomsService.recordParticipantHeartbeats).toHaveBeenCalledWith(
      payload.participants,
    );
  });

  it('GIVEN valid snapshot WHEN handleSnapshotReady THEN also persists binary state via RoomsService', async () => {
    const mocks = createMocks();
    mocks.db.limit.mockResolvedValueOnce([{ id: 'session-1', language: 'typescript' }]);
    const controller = await createController(mocks);

    const payload: SnapshotReadyPayload = {
      roomId: 'room-abc',
      snapshot: [9, 8, 7, 6],
      code: 'let z = 3;',
      language: 'typescript',
      timestamp: 1712500003000,
      trigger: 'periodic',
    };

    await controller.handleSnapshotReady(payload);

    expect(mocks.roomsService.persistDocSnapshot).toHaveBeenCalledOnce();
    const [roomIdArg, stateArg] = mocks.roomsService.persistDocSnapshot.mock.calls[0];
    expect(roomIdArg).toBe('room-abc');
    expect(stateArg).toBeInstanceOf(Uint8Array);
    expect(Array.from(stateArg as Uint8Array)).toEqual([9, 8, 7, 6]);
  });

  it('GIVEN snapshot for room without session WHEN handleSnapshotReady THEN skips DB insert and still returns success', async () => {
    const mocks = createMocks();
    mocks.db.limit.mockResolvedValueOnce([]);
    const controller = await createController(mocks);

    const payload: SnapshotReadyPayload = {
      roomId: 'room-123',
      snapshot: [1, 2, 3],
      code: 'const x = 1;',
      language: 'typescript',
      timestamp: 1712500000000,
      trigger: 'periodic',
    };

    const result = await controller.handleSnapshotReady(payload);

    expect(result).toEqual({ success: true });
    expect(mocks.storageService.upload).toHaveBeenCalled();
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });

  it('GIVEN final snapshot for room without session WHEN handleSnapshotReady THEN returns success false', async () => {
    const mocks = createMocks();
    mocks.db.limit.mockResolvedValueOnce([]);
    const controller = await createController(mocks);

    const payload: SnapshotReadyPayload = {
      roomId: 'room-123',
      snapshot: [1, 2, 3],
      code: 'const x = 1;',
      language: 'typescript',
      timestamp: 1712500000000,
      trigger: 'session_end',
    };

    const result = await controller.handleSnapshotReady(payload);

    expect(result).toEqual({ success: false });
    expect(mocks.roomsService.persistDocSnapshot).toHaveBeenCalledOnce();
    expect(mocks.storageService.upload).not.toHaveBeenCalled();
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });

  it('GIVEN valid doc snapshot payload WHEN handlePersistDocSnapshot THEN calls RoomsService.persistDocSnapshot and returns success', async () => {
    const mocks = createMocks();
    const controller = await createController(mocks);

    const result = await controller.handlePersistDocSnapshot('room-42', {
      state: [5, 6, 7],
    });

    expect(result).toEqual({ success: true });
    expect(mocks.roomsService.persistDocSnapshot).toHaveBeenCalledOnce();
    const [passedRoomId, passedState] = mocks.roomsService.persistDocSnapshot.mock.calls[0];
    expect(passedRoomId).toBe('room-42');
    expect(passedState).toBeInstanceOf(Uint8Array);
    expect(Array.from(passedState)).toEqual([5, 6, 7]);
  });

  it('GIVEN service failure WHEN handlePersistDocSnapshot THEN returns success false and does not throw', async () => {
    const mocks = createMocks();
    mocks.roomsService.persistDocSnapshot.mockRejectedValueOnce(new Error('db down'));
    const controller = await createController(mocks);

    const result = await controller.handlePersistDocSnapshot('room-42', {
      state: [1],
    });

    expect(result).toEqual({ success: false });
  });

  it('GIVEN snapshot larger than 5 MiB WHEN handlePersistDocSnapshot THEN rejects without persisting', async () => {
    const mocks = createMocks();
    const controller = await createController(mocks);

    const sixMb = new Array<number>(6 * 1024 * 1024).fill(0);

    const result = await controller.handlePersistDocSnapshot('room-big', {
      state: sixMb,
    });

    expect(result).toEqual({ success: false });
    expect(mocks.roomsService.persistDocSnapshot).not.toHaveBeenCalled();
  });
});
