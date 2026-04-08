import { Test } from '@nestjs/testing';
import type { SnapshotReadyPayload, UserDisconnectedPayload } from '@syncode/contracts';
import { STORAGE_SERVICE } from '@syncode/shared/ports';
import { describe, expect, it, vi } from 'vitest';
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
  };
}

async function createController(mocks: ReturnType<typeof createMocks>) {
  const module = await Test.createTestingModule({
    controllers: [InternalController],
    providers: [
      { provide: RoomsService, useValue: mocks.roomsService },
      { provide: STORAGE_SERVICE, useValue: mocks.storageService },
    ],
  }).compile();

  return module.get(InternalController);
}

describe('InternalController', () => {
  it('GIVEN valid snapshot payload WHEN handleSnapshotReady THEN uploads to correct S3 key with proper metadata and returns success true', async () => {
    const mocks = createMocks();
    const controller = await createController(mocks);

    const payload: SnapshotReadyPayload = {
      roomId: 'room-123',
      snapshot: [1, 2, 3],
      timestamp: 1712500000000,
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
      timestamp: 1712500001000,
    };

    const result = await controller.handleSnapshotReady(payload);

    expect(result).toEqual({ success: false });
  });

  it('GIVEN valid disconnect payload WHEN handleUserDisconnected THEN delegates to RoomsService and returns success', async () => {
    const mocks = createMocks();
    const controller = await createController(mocks);

    const payload: UserDisconnectedPayload = {
      roomId: 'room-789',
      userId: 'user-001',
      timestamp: 1712500002000,
    };

    const result = await controller.handleUserDisconnected(payload);

    expect(result).toEqual({ success: true });
    expect(mocks.roomsService.markParticipantInactive).toHaveBeenCalledWith(
      'room-789',
      'user-001',
      new Date(1712500002000),
    );
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
});
