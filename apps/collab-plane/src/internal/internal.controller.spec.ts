import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';
import { CollaborationService } from '../collaboration/collaboration.service.js';
import { InternalController } from './internal.controller.js';

function createMocks() {
  return {
    collaborationService: {
      createDocument: vi.fn(),
      destroyDocument: vi.fn(),
      kickUser: vi.fn(),
      updateRoomState: vi.fn(),
    },
  };
}

async function createController(mocks: ReturnType<typeof createMocks>) {
  const module = await Test.createTestingModule({
    controllers: [InternalController],
    providers: [{ provide: CollaborationService, useValue: mocks.collaborationService }],
  }).compile();

  return module.get(InternalController);
}

describe('InternalController', () => {
  describe('createDocument', () => {
    it('GIVEN valid request WHEN creating document THEN returns response', async () => {
      const mocks = createMocks();
      mocks.collaborationService.createDocument.mockResolvedValue({
        roomId: 'room-1',
        createdAt: 1000,
      });
      const controller = await createController(mocks);

      const result = await controller.createDocument({ roomId: 'room-1' });

      expect(result).toEqual({ roomId: 'room-1', createdAt: 1000 });
    });

    it('GIVEN duplicate room WHEN creating document THEN throws ConflictException', async () => {
      const mocks = createMocks();
      mocks.collaborationService.createDocument.mockRejectedValue(new ConflictException());
      const controller = await createController(mocks);

      await expect(controller.createDocument({ roomId: 'room-1' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('destroyDocument', () => {
    it('GIVEN existing document WHEN destroying THEN returns response', async () => {
      const mocks = createMocks();
      mocks.collaborationService.destroyDocument.mockResolvedValue({ roomId: 'room-1' });
      const controller = await createController(mocks);

      const result = await controller.destroyDocument('room-1');

      expect(result).toEqual({ roomId: 'room-1' });
    });

    it('GIVEN missing document WHEN destroying THEN throws NotFoundException', async () => {
      const mocks = createMocks();
      mocks.collaborationService.destroyDocument.mockRejectedValue(new NotFoundException());
      const controller = await createController(mocks);

      await expect(controller.destroyDocument('room-1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('kickUser', () => {
    it('GIVEN connected user WHEN kicking THEN returns kicked=true', async () => {
      const mocks = createMocks();
      mocks.collaborationService.kickUser.mockResolvedValue({ kicked: true });
      const controller = await createController(mocks);

      const result = await controller.kickUser('room-1', { userId: 'user-1' });

      expect(result).toEqual({ kicked: true });
    });
  });

  describe('updateRoomState', () => {
    it('GIVEN valid request WHEN updating room state THEN delegates to service and returns success', async () => {
      const mocks = createMocks();
      mocks.collaborationService.updateRoomState.mockResolvedValue({ success: true });
      const controller = await createController(mocks);

      const result = await controller.updateRoomState('room-1', {
        roomId: 'room-1',
        phase: 'coding',
        editorLocked: false,
      });

      expect(result).toEqual({ success: true });
      expect(mocks.collaborationService.updateRoomState).toHaveBeenCalledWith({
        roomId: 'room-1',
        phase: 'coding',
        editorLocked: false,
      });
    });
  });

  describe('health', () => {
    it('WHEN checking health THEN returns ok', async () => {
      const mocks = createMocks();
      const controller = await createController(mocks);

      expect(controller.health()).toEqual({ status: 'ok' });
    });
  });
});
