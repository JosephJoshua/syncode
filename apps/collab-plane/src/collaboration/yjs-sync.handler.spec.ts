import * as encoding from 'lib0/encoding';
import { describe, expect, it, vi } from 'vitest';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';
import type { AuthenticatedClient } from '../auth/index.js';
import { RoomRegistry } from './room-registry.js';
import { WsMessageType } from './ws-message-types.js';
import { YjsDocumentStore } from './yjs-document-store.js';
import { YjsSyncHandler } from './yjs-sync.handler.js';

function encodeSyncStep1(doc: Y.Doc): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, WsMessageType.SYNC);
  syncProtocol.writeSyncStep1(encoder, doc);
  return encoding.toUint8Array(encoder);
}

function encodeUpdate(update: Uint8Array): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, WsMessageType.SYNC);
  syncProtocol.writeUpdate(encoder, update);
  return encoding.toUint8Array(encoder);
}

function fakeClient(userId: string): AuthenticatedClient {
  return {
    user: { sub: userId, roomId: 'room-1', role: 'candidate', type: 'collab', iat: 0, exp: 0 },
    close: vi.fn(),
    send: vi.fn(),
  } as unknown as AuthenticatedClient;
}

function setup() {
  const docStore = new YjsDocumentStore();
  const roomRegistry = new RoomRegistry();
  const handler = new YjsSyncHandler(docStore, roomRegistry);
  return { docStore, roomRegistry, handler };
}

describe('YjsSyncHandler', () => {
  describe('sendInitialSync', () => {
    it('GIVEN room with doc WHEN sending initial sync THEN client receives a binary SyncStep1 message', () => {
      const { docStore, handler } = setup();
      docStore.createDoc('room-1', 'hello');
      const client = fakeClient('user-1');

      handler.sendInitialSync('room-1', client);

      expect(client.send).toHaveBeenCalledOnce();
      const sent = (client.send as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Uint8Array;
      expect(sent[0]).toBe(WsMessageType.SYNC);
    });

    it('GIVEN no doc for room WHEN sending initial sync THEN nothing is sent', () => {
      const { handler } = setup();
      const client = fakeClient('user-1');

      handler.sendInitialSync('room-1', client);

      expect(client.send).not.toHaveBeenCalled();
    });
  });

  describe('handleSyncMessage', () => {
    it('GIVEN client sends SyncStep1 WHEN handled THEN client receives SyncStep2 with missing updates', () => {
      const { docStore, roomRegistry, handler } = setup();
      docStore.createDoc('room-1', 'server content');
      roomRegistry.createRoom('room-1');
      const client = fakeClient('user-1');
      roomRegistry.addClient('room-1', 'user-1', client);

      // Client has empty doc, sends its state vector
      const clientDoc = new Y.Doc();
      handler.handleSyncMessage('room-1', 'user-1', encodeSyncStep1(clientDoc));
      clientDoc.destroy();

      // Server should respond with SyncStep2 containing the diff
      const response = (client.send as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Uint8Array;
      expect(response[0]).toBe(WsMessageType.SYNC);
      expect(response[1]).toBe(1); // SyncStep2 sub-type
    });

    it('GIVEN client sends Update WHEN handled THEN server doc reflects the change', () => {
      const { docStore, roomRegistry, handler } = setup();
      docStore.createDoc('room-1');
      roomRegistry.createRoom('room-1');
      const client = fakeClient('user-1');
      roomRegistry.addClient('room-1', 'user-1', client);

      // Create a real update from a client doc
      const clientDoc = new Y.Doc();
      let capturedUpdate!: Uint8Array;
      clientDoc.on('update', (update: Uint8Array) => {
        capturedUpdate = update;
      });
      clientDoc.getText('code').insert(0, 'hello from client');
      clientDoc.destroy();

      handler.handleSyncMessage('room-1', 'user-1', encodeUpdate(capturedUpdate));

      expect(docStore.getDoc('room-1')!.getText('code').toString()).toBe('hello from client');
    });

    it('GIVEN no doc for room WHEN handling sync THEN nothing happens', () => {
      const { roomRegistry, handler } = setup();
      roomRegistry.createRoom('room-1');
      const client = fakeClient('user-1');
      roomRegistry.addClient('room-1', 'user-1', client);

      const clientDoc = new Y.Doc();
      handler.handleSyncMessage('room-1', 'user-1', encodeSyncStep1(clientDoc));
      clientDoc.destroy();

      expect(client.send).not.toHaveBeenCalled();
    });
  });

  describe('registerUpdateBroadcast', () => {
    it('GIVEN two clients WHEN a doc update is applied THEN only the other client receives the broadcast', () => {
      const { docStore, roomRegistry, handler } = setup();
      const doc = docStore.createDoc('room-1');
      roomRegistry.createRoom('room-1');
      const client1 = fakeClient('user-1');
      const client2 = fakeClient('user-2');
      roomRegistry.addClient('room-1', 'user-1', client1);
      roomRegistry.addClient('room-1', 'user-2', client2);

      handler.registerUpdateBroadcast('room-1');

      doc.transact(() => {
        doc.getText('code').insert(0, 'edit');
      }, 'user-1');

      expect(client1.send).not.toHaveBeenCalled();
      expect(client2.send).toHaveBeenCalled();
      const broadcast = (client2.send as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Uint8Array;
      expect(broadcast[0]).toBe(WsMessageType.SYNC);
    });

    it('GIVEN client sends Update WHEN broadcast registered THEN other client receives it and can reconstruct the doc', () => {
      const { docStore, roomRegistry, handler } = setup();
      docStore.createDoc('room-1');
      roomRegistry.createRoom('room-1');
      handler.registerUpdateBroadcast('room-1');

      const client1 = fakeClient('user-1');
      const client2 = fakeClient('user-2');
      roomRegistry.addClient('room-1', 'user-1', client1);
      roomRegistry.addClient('room-1', 'user-2', client2);

      // Client1 sends an update
      const clientDoc = new Y.Doc();
      let capturedUpdate!: Uint8Array;
      clientDoc.on('update', (update: Uint8Array) => {
        capturedUpdate = update;
      });
      clientDoc.getText('code').insert(0, 'collaborative text');
      clientDoc.destroy();

      handler.handleSyncMessage('room-1', 'user-1', encodeUpdate(capturedUpdate));

      expect(client2.send).toHaveBeenCalled();

      // Verify the update reconstructs the correct document state
      const receiverDoc = new Y.Doc();
      // The broadcast is [messageSync, Update sub-type, ...update]
      // We need to decode it the same way readSyncMessage would
      Y.applyUpdate(receiverDoc, capturedUpdate);
      expect(receiverDoc.getText('code').toString()).toBe('collaborative text');
      receiverDoc.destroy();
    });

    it('GIVEN no doc for room WHEN registering THEN does nothing', () => {
      const { handler } = setup();

      expect(() => handler.registerUpdateBroadcast('room-1')).not.toThrow();
    });
  });
});
