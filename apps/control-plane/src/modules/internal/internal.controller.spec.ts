import { Test } from '@nestjs/testing';
import type { SnapshotReadyPayload, UserDisconnectedPayload } from '@syncode/contracts';
import { STORAGE_SERVICE } from '@syncode/shared/ports';
import { describe, expect, it, vi } from 'vitest';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import { RoomsService } from '@/modules/rooms/rooms.service.js';
import { InternalController } from './internal.controller.js';

function createMocks() {
  return {
    roomsService: {
      markParticipantInactive: vi.fn().mockResolvedValue(undefined),
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
  }).compile();

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

  it('GIVEN storage upload fails WHEN handleSnapshotReady THEN returns success false and does not throw', async () => {
    const mocks = createMocks();
    mocks.storageService.upload.mockRejectedValue(new Error('S3 unavailable'));
    const controller = await createController(mocks);

    const payload: SnapshotReadyPayload = {
      roomId: 'room-456',
      snapshot: [4, 5, 6],
      code: 'let y = 2;',
      timestamp: 1712500001000,
      trigger: 'submission',
    };

    const result = await controller.handleSnapshotReady(payload);

    expect(result).toEqual({ success: false });
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

  it('GIVEN valid snapshot with session WHEN handleSnapshotReady THEN inserts into DB and returns success', async () => {
    const mocks = createMocks();
    mocks.db.limit.mockResolvedValueOnce([{ id: 'session-1', language: 'typescript' }]);
    const controller = await createController(mocks);

    const payload: SnapshotReadyPayload = {
      roomId: 'room-123',
      snapshot: [1, 2, 3],
      code: 'const x = 1;',
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
        code: 'const x = 1;',
        language: 'typescript',
        trigger: 'periodic',
      }),
    );
  });

  it('GIVEN snapshot for room without session WHEN handleSnapshotReady THEN skips DB insert and still returns success', async () => {
    const mocks = createMocks();
    mocks.db.limit.mockResolvedValueOnce([]);
    const controller = await createController(mocks);

    const payload: SnapshotReadyPayload = {
      roomId: 'room-123',
      snapshot: [1, 2, 3],
      code: 'const x = 1;',
      timestamp: 1712500000000,
      trigger: 'periodic',
    };

    const result = await controller.handleSnapshotReady(payload);

    expect(result).toEqual({ success: true });
    expect(mocks.storageService.upload).toHaveBeenCalled();
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });
});
