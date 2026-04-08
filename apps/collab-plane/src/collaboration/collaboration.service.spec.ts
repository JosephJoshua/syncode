import { ConflictException, NotFoundException } from '@nestjs/common';
import type { IControlPlaneCallbackClient } from '@syncode/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedClient } from '../auth/index.js';
import { CollaborationService } from './collaboration.service.js';
import { RoomRegistry } from './room-registry.js';
import { WsCloseCode } from './ws-close-codes.js';

function fakeClient(): AuthenticatedClient {
  return {
    close: vi.fn(),
    send: vi.fn(),
    user: { sub: 'user-1', roomId: 'room-1', role: 'candidate', type: 'collab', iat: 0, exp: 0 },
  } as unknown as AuthenticatedClient;
}

function createFixture() {
  const roomRegistry = new RoomRegistry();
  const callbackClient: IControlPlaneCallbackClient = {
    notifyUserDisconnected: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    notifySnapshotReady: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  };

  const docStore = {
    createDoc: vi.fn(),
    destroyDoc: vi.fn(),
    getDoc: vi.fn(),
    encodeSnapshot: vi.fn(),
  };
  const syncHandler = { registerUpdateBroadcast: vi.fn() };
  const awarenessHandler = { createRoom: vi.fn(), destroyRoom: vi.fn(), removeClient: vi.fn() };
  const snapshotScheduler = {
    startPeriodicSnapshots: vi.fn(),
    stopPeriodicSnapshots: vi.fn(),
    takeSnapshot: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    destroyRoom: vi.fn(),
  };

  const service = new CollaborationService(
    roomRegistry,
    callbackClient,
    docStore as any,
    syncHandler as any,
    awarenessHandler as any,
    snapshotScheduler as any,
  );

  return {
    service,
    roomRegistry,
    callbackClient,
    docStore,
    syncHandler,
    awarenessHandler,
    snapshotScheduler,
  };
}

describe('CollaborationService', () => {
  describe('createDocument', () => {
    it('GIVEN no existing document WHEN creating THEN creates room and returns response', async () => {
      const { service, docStore, syncHandler, awarenessHandler, snapshotScheduler } =
        createFixture();

      const result = await service.createDocument({ roomId: 'room-1' });

      expect(result.roomId).toBe('room-1');
      expect(result.createdAt).toBeGreaterThan(0);
      expect(docStore.createDoc).toHaveBeenCalledWith('room-1', undefined);
      expect(syncHandler.registerUpdateBroadcast).toHaveBeenCalledWith('room-1');
      expect(awarenessHandler.createRoom).toHaveBeenCalledWith('room-1');
      expect(snapshotScheduler.startPeriodicSnapshots).toHaveBeenCalledWith('room-1');
    });

    it('GIVEN existing document WHEN creating duplicate THEN throws ConflictException', async () => {
      const { service } = createFixture();
      await service.createDocument({ roomId: 'room-1' });

      await expect(service.createDocument({ roomId: 'room-1' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('destroyDocument', () => {
    it('GIVEN document with connected clients WHEN destroying THEN closes all clients with 4003', async () => {
      const { service, roomRegistry, docStore, awarenessHandler, snapshotScheduler } =
        createFixture();
      await service.createDocument({ roomId: 'room-1' });

      const client1 = fakeClient();
      const client2 = fakeClient();
      roomRegistry.addClient('room-1', 'user-1', client1);
      roomRegistry.addClient('room-1', 'user-2', client2);

      const result = await service.destroyDocument('room-1');

      expect(result.roomId).toBe('room-1');
      expect(snapshotScheduler.takeSnapshot).toHaveBeenCalledWith('room-1', 'session_end');
      expect(snapshotScheduler.destroyRoom).toHaveBeenCalledWith('room-1');
      expect(client1.close).toHaveBeenCalledWith(WsCloseCode.ROOM_CLOSED, 'Room closed');
      expect(client2.close).toHaveBeenCalledWith(WsCloseCode.ROOM_CLOSED, 'Room closed');
      expect(awarenessHandler.destroyRoom).toHaveBeenCalledWith('room-1');
      expect(docStore.destroyDoc).toHaveBeenCalledWith('room-1');
      expect(roomRegistry.hasRoom('room-1')).toBe(false);
    });

    it('GIVEN non-existent document WHEN destroying THEN throws NotFoundException', async () => {
      const { service } = createFixture();

      await expect(service.destroyDocument('room-1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('kickUser', () => {
    it('GIVEN connected user WHEN kicking THEN closes with 4002 and returns kicked=true', async () => {
      const { service, roomRegistry, awarenessHandler } = createFixture();
      await service.createDocument({ roomId: 'room-1' });
      const client = fakeClient();
      roomRegistry.addClient('room-1', 'user-1', client);

      const result = await service.kickUser('room-1', { userId: 'user-1', reason: 'Disruptive' });

      expect(result.kicked).toBe(true);
      expect(awarenessHandler.removeClient).toHaveBeenCalledWith('room-1', 'user-1');
      expect(client.close).toHaveBeenCalledWith(WsCloseCode.KICKED, 'Disruptive');
    });

    it('GIVEN non-existent user WHEN kicking THEN returns kicked=false', async () => {
      const { service } = createFixture();

      const result = await service.kickUser('room-1', { userId: 'user-1' });

      expect(result.kicked).toBe(false);
    });
  });

  describe('notifyUserDisconnected', () => {
    it('GIVEN callback client WHEN notifying THEN calls callback with payload', () => {
      const { service, callbackClient } = createFixture();
      const payload = { roomId: 'room-1', userId: 'user-1', timestamp: Date.now() };

      service.notifyUserDisconnected(payload);

      expect(callbackClient.notifyUserDisconnected).toHaveBeenCalledWith(payload);
    });
  });
});
