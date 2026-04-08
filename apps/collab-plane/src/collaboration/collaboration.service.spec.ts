import { ConflictException, NotFoundException } from '@nestjs/common';
import type { IControlPlaneCallbackClient } from '@syncode/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedClient } from '../auth/index.js';
import type { AwarenessHandler } from './awareness.handler.js';
import { CollaborationService } from './collaboration.service.js';
import { RoomRegistry } from './room-registry.js';
import type { SnapshotScheduler } from './snapshot.scheduler.js';
import { WsCloseCode } from './ws-close-codes.js';
import type { YjsDocumentStore } from './yjs-document-store.js';
import type { YjsSyncHandler } from './yjs-sync.handler.js';

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
    docStore as unknown as YjsDocumentStore,
    syncHandler as unknown as YjsSyncHandler,
    awarenessHandler as unknown as AwarenessHandler,
    snapshotScheduler as unknown as SnapshotScheduler,
  );

  return { service, roomRegistry, callbackClient, docStore, snapshotScheduler };
}

describe('CollaborationService', () => {
  describe('createDocument', () => {
    it('GIVEN valid request WHEN creating document THEN returns roomId and createdAt', async () => {
      const { service } = createFixture();

      const result = await service.createDocument({ roomId: 'room-1' });

      expect(result.roomId).toBe('room-1');
      expect(result.createdAt).toBeGreaterThan(0);
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
    it('GIVEN document with connected clients WHEN destroying THEN closes all clients and removes room', async () => {
      const { service, roomRegistry } = createFixture();
      await service.createDocument({ roomId: 'room-1' });

      const client1 = fakeClient();
      const client2 = fakeClient();
      roomRegistry.addClient('room-1', 'user-1', client1);
      roomRegistry.addClient('room-1', 'user-2', client2);

      const result = await service.destroyDocument('room-1');

      expect(result.roomId).toBe('room-1');
      expect(client1.close).toHaveBeenCalledWith(WsCloseCode.ROOM_CLOSED, 'Room closed');
      expect(client2.close).toHaveBeenCalledWith(WsCloseCode.ROOM_CLOSED, 'Room closed');
      expect(roomRegistry.hasRoom('room-1')).toBe(false);
    });

    it('GIVEN document WHEN destroying THEN returns finalSnapshot when doc has content', async () => {
      const { service, docStore } = createFixture();
      await service.createDocument({ roomId: 'room-1' });

      docStore.destroyDoc.mockReturnValue(new Uint8Array([1, 2, 3]));

      const result = await service.destroyDocument('room-1');

      expect(result.finalSnapshot).toEqual([1, 2, 3]);
    });

    it('GIVEN non-existent document WHEN destroying THEN throws NotFoundException', async () => {
      const { service } = createFixture();

      await expect(service.destroyDocument('room-1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('kickUser', () => {
    it('GIVEN connected user WHEN kicking with reason THEN closes with 4002 and returns kicked=true', async () => {
      const { service, roomRegistry } = createFixture();
      await service.createDocument({ roomId: 'room-1' });
      const client = fakeClient();
      roomRegistry.addClient('room-1', 'user-1', client);

      const result = await service.kickUser('room-1', { userId: 'user-1', reason: 'Disruptive' });

      expect(result.kicked).toBe(true);
      expect(client.close).toHaveBeenCalledWith(WsCloseCode.KICKED, 'Disruptive');
    });

    it('GIVEN connected user WHEN kicking without reason THEN uses default reason', async () => {
      const { service, roomRegistry } = createFixture();
      await service.createDocument({ roomId: 'room-1' });
      const client = fakeClient();
      roomRegistry.addClient('room-1', 'user-1', client);

      const result = await service.kickUser('room-1', { userId: 'user-1' });

      expect(result.kicked).toBe(true);
      expect(client.close).toHaveBeenCalledWith(WsCloseCode.KICKED, 'Kicked');
    });

    it('GIVEN non-existent user WHEN kicking THEN returns kicked=false', async () => {
      const { service } = createFixture();

      const result = await service.kickUser('room-1', { userId: 'user-1' });

      expect(result.kicked).toBe(false);
    });
  });

  describe('room TTL', () => {
    it('GIVEN room with no clients WHEN 5 minutes elapse THEN room is cleaned up', async () => {
      vi.useFakeTimers();
      const { service, roomRegistry } = createFixture();
      await service.createDocument({ roomId: 'room-1' });

      service.checkRoomEmpty('room-1');

      expect(roomRegistry.hasRoom('room-1')).toBe(true);

      vi.advanceTimersByTime(5 * 60 * 1000);

      expect(roomRegistry.hasRoom('room-1')).toBe(false);
      vi.useRealTimers();
    });

    it('GIVEN scheduled TTL WHEN client reconnects THEN cleanup is cancelled', async () => {
      vi.useFakeTimers();
      const { service, roomRegistry } = createFixture();
      await service.createDocument({ roomId: 'room-1' });

      service.checkRoomEmpty('room-1');

      service.cancelRoomCleanup('room-1');

      vi.advanceTimersByTime(5 * 60 * 1000);

      expect(roomRegistry.hasRoom('room-1')).toBe(true);
      vi.useRealTimers();
    });

    it('GIVEN room with clients WHEN checkRoomEmpty THEN no TTL scheduled', async () => {
      vi.useFakeTimers();
      const { service, roomRegistry } = createFixture();
      await service.createDocument({ roomId: 'room-1' });

      const client = {
        close: vi.fn(),
        send: vi.fn(),
        user: { sub: 'u1', roomId: 'room-1', role: 'candidate', type: 'collab', iat: 0, exp: 0 },
      } as unknown as AuthenticatedClient;
      roomRegistry.addClient('room-1', 'u1', client);

      service.checkRoomEmpty('room-1');

      vi.advanceTimersByTime(5 * 60 * 1000);

      expect(roomRegistry.hasRoom('room-1')).toBe(true);
      vi.useRealTimers();
    });
  });
});
