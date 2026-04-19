import { NotFoundException } from '@nestjs/common';
import { COLLAB_WS_EVENTS, type IControlPlaneCallbackClient } from '@syncode/contracts';
import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
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
    persistDocSnapshot: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  };

  const docStore = {
    createDoc: vi.fn().mockReturnValue({ doc: new Y.Doc(), created: true }),
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
    it('GIVEN valid request WHEN creating document THEN returns roomId, createdAt and created=true', async () => {
      const { service } = createFixture();

      const result = await service.createDocument({ roomId: 'room-1' });

      expect(result.roomId).toBe('room-1');
      expect(result.createdAt).toBeGreaterThan(0);
      expect(result.created).toBe(true);
    });

    it('GIVEN existing document WHEN creating duplicate THEN returns created=false without throwing', async () => {
      const { service, docStore } = createFixture();
      docStore.createDoc
        .mockReturnValueOnce({ doc: new Y.Doc(), created: true })
        .mockReturnValueOnce({ doc: new Y.Doc(), created: false });

      await service.createDocument({ roomId: 'room-1' });
      const result = await service.createDocument({ roomId: 'room-1' });

      expect(result.created).toBe(false);
      expect(result.roomId).toBe('room-1');
    });

    it('GIVEN snapshot in request WHEN creating THEN forwards snapshot bytes to docStore and omits initialContent', async () => {
      const { service, docStore } = createFixture();

      await service.createDocument({
        roomId: 'room-1',
        snapshot: [1, 2, 3],
        initialContent: 'ignored',
      });

      const [, options] = docStore.createDoc.mock.calls[0];
      expect(options.snapshot).toBeInstanceOf(Uint8Array);
      expect(Array.from(options.snapshot as Uint8Array)).toEqual([1, 2, 3]);
      expect(options.initialContent).toBeUndefined();
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

  describe('updateRoomState', () => {
    it('GIVEN room with connected clients WHEN updating state THEN broadcasts room-state to all clients', async () => {
      const { service, roomRegistry } = createFixture();
      await service.createDocument({ roomId: 'room-1' });

      const client1 = fakeClient();
      const client2 = fakeClient();
      roomRegistry.addClient('room-1', 'user-1', client1);
      roomRegistry.addClient('room-1', 'user-2', client2);

      const result = await service.updateRoomState({
        roomId: 'room-1',
        phase: 'coding',
        editorLocked: false,
      });

      expect(result).toEqual({ success: true });

      const sentMessage = JSON.parse((client1.send as ReturnType<typeof vi.fn>).mock.calls[0][0]);
      expect(sentMessage.type).toBe(COLLAB_WS_EVENTS.ROOM_STATE);
      expect(sentMessage.data.phase).toBe('coding');
      expect(sentMessage.data.editorLocked).toBe(false);

      expect((client2.send as ReturnType<typeof vi.fn>).mock.calls[0]).toBeDefined();
    });

    it('GIVEN room with no connected clients WHEN updating state THEN returns success', async () => {
      const { service } = createFixture();
      await service.createDocument({ roomId: 'room-1' });

      const result = await service.updateRoomState({
        roomId: 'room-1',
        phase: 'warmup',
        editorLocked: true,
      });

      expect(result).toEqual({ success: true });
    });

    it('GIVEN phase change WHEN updating state THEN takes phase_change snapshot', async () => {
      const { service, snapshotScheduler } = createFixture();
      await service.createDocument({ roomId: 'room-1', initialPhase: 'waiting' });

      await service.updateRoomState({
        roomId: 'room-1',
        phase: 'coding',
        editorLocked: false,
      });

      expect(snapshotScheduler.takeSnapshot).toHaveBeenCalledWith('room-1', 'phase_change');
    });

    it('GIVEN editorLocked changes false to true WHEN updating state THEN takes submission snapshot', async () => {
      const { service, snapshotScheduler } = createFixture();
      await service.createDocument({ roomId: 'room-1', editorLocked: false });

      await service.updateRoomState({
        roomId: 'room-1',
        phase: 'coding',
        editorLocked: true,
      });

      expect(snapshotScheduler.takeSnapshot).toHaveBeenCalledWith('room-1', 'submission');
    });

    it('GIVEN same phase WHEN updating state THEN does not take phase_change snapshot', async () => {
      const { service, snapshotScheduler } = createFixture();
      await service.createDocument({ roomId: 'room-1', initialPhase: 'coding' });

      await service.updateRoomState({
        roomId: 'room-1',
        phase: 'coding',
        editorLocked: true,
      });

      expect(snapshotScheduler.takeSnapshot).not.toHaveBeenCalledWith('room-1', 'phase_change');
    });

    it('GIVEN phase change WHEN updating state THEN broadcasts phase-change event to all clients', async () => {
      const { service, roomRegistry } = createFixture();
      await service.createDocument({ roomId: 'room-1', initialPhase: 'waiting' });

      const client = fakeClient();
      roomRegistry.addClient('room-1', 'user-1', client);

      await service.updateRoomState({
        roomId: 'room-1',
        phase: 'coding',
        editorLocked: false,
      });

      const calls = (client.send as ReturnType<typeof vi.fn>).mock.calls;
      const messages = calls.map((c: [string]) => JSON.parse(c[0]));
      const phaseChangeMsg = messages.find(
        (m: { type: string }) => m.type === COLLAB_WS_EVENTS.PHASE_CHANGE,
      );
      expect(phaseChangeMsg).toBeDefined();
      expect(phaseChangeMsg.data.phase).toBe('coding');
      expect(phaseChangeMsg.data.previousPhase).toBe('waiting');
    });

    it('GIVEN editorLocked changes WHEN updating state THEN broadcasts editor-lock event to all clients', async () => {
      const { service, roomRegistry } = createFixture();
      await service.createDocument({ roomId: 'room-1', editorLocked: false });

      const client = fakeClient();
      roomRegistry.addClient('room-1', 'user-1', client);

      await service.updateRoomState({
        roomId: 'room-1',
        phase: 'waiting',
        editorLocked: true,
        changedBy: 'host-user',
      });

      const calls = (client.send as ReturnType<typeof vi.fn>).mock.calls;
      const messages = calls.map((c: [string]) => JSON.parse(c[0]));
      const lockMsg = messages.find(
        (m: { type: string }) => m.type === COLLAB_WS_EVENTS.EDITOR_LOCK,
      );
      expect(lockMsg).toBeDefined();
      expect(lockMsg.data.locked).toBe(true);
      expect(lockMsg.data.lockedBy).toBe('host-user');
    });

    it('GIVEN both phase and lock change WHEN updating state THEN triggers phase_change snapshot but not submission snapshot', async () => {
      const { service, roomRegistry, snapshotScheduler } = createFixture();
      await service.createDocument({
        roomId: 'room-1',
        initialPhase: 'coding',
        editorLocked: true,
      });

      const client = fakeClient();
      roomRegistry.addClient('room-1', 'user-1', client);

      await service.updateRoomState({
        roomId: 'room-1',
        phase: 'wrapup',
        editorLocked: false,
      });

      expect(snapshotScheduler.takeSnapshot).toHaveBeenCalledWith('room-1', 'phase_change');
      expect(snapshotScheduler.takeSnapshot).not.toHaveBeenCalledWith('room-1', 'submission');

      const calls = (client.send as ReturnType<typeof vi.fn>).mock.calls;
      const messages = calls.map((c: [string]) => JSON.parse(c[0]));
      expect(messages.some((m: { type: string }) => m.type === COLLAB_WS_EVENTS.PHASE_CHANGE)).toBe(
        true,
      );
      expect(messages.some((m: { type: string }) => m.type === COLLAB_WS_EVENTS.EDITOR_LOCK)).toBe(
        true,
      );
    });
  });

  describe('room TTL', () => {
    it('GIVEN room with no clients WHEN 5 minutes elapse THEN room is cleaned up', async () => {
      vi.useFakeTimers();
      const { service, roomRegistry } = createFixture();
      await service.createDocument({ roomId: 'room-1' });

      service.checkRoomEmpty('room-1');

      expect(roomRegistry.hasRoom('room-1')).toBe(true);

      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      expect(roomRegistry.hasRoom('room-1')).toBe(false);
      vi.useRealTimers();
    });

    it('GIVEN room with doc WHEN TTL expires THEN persists doc snapshot before destroy', async () => {
      vi.useFakeTimers();
      const { service, callbackClient, docStore } = createFixture();

      const liveDoc = new Y.Doc();
      liveDoc.getText('code').insert(0, 'final-state');
      docStore.createDoc.mockReturnValueOnce({ doc: liveDoc, created: true });
      docStore.getDoc.mockReturnValue(liveDoc);

      await service.createDocument({ roomId: 'room-1' });

      service.checkRoomEmpty('room-1');
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      expect(callbackClient.persistDocSnapshot).toHaveBeenCalledOnce();
      const payload = vi.mocked(callbackClient.persistDocSnapshot).mock.calls[0]![0];
      expect(payload.roomId).toBe('room-1');

      const restored = new Y.Doc();
      Y.applyUpdate(restored, new Uint8Array(payload.state));
      expect(restored.getText('code').toString()).toBe('final-state');
      restored.destroy();

      vi.useRealTimers();
    });

    it('GIVEN persistDocSnapshot rejects WHEN TTL expires THEN teardown still completes', async () => {
      vi.useFakeTimers();
      const { service, callbackClient, docStore, roomRegistry } = createFixture();

      const liveDoc = new Y.Doc();
      docStore.createDoc.mockReturnValueOnce({ doc: liveDoc, created: true });
      docStore.getDoc.mockReturnValue(liveDoc);
      vi.mocked(callbackClient.persistDocSnapshot).mockRejectedValueOnce(new Error('boom'));

      await service.createDocument({ roomId: 'room-1' });

      service.checkRoomEmpty('room-1');
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      expect(roomRegistry.hasRoom('room-1')).toBe(false);
      vi.useRealTimers();
    });

    it('GIVEN scheduled TTL WHEN client reconnects THEN cleanup is cancelled', async () => {
      vi.useFakeTimers();
      const { service, roomRegistry } = createFixture();
      await service.createDocument({ roomId: 'room-1' });

      service.checkRoomEmpty('room-1');

      service.cancelRoomCleanup('room-1');

      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

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

      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      expect(roomRegistry.hasRoom('room-1')).toBe(true);
      vi.useRealTimers();
    });
  });
});
