import * as encoding from 'lib0/encoding';
import { describe, expect, it, vi } from 'vitest';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';
import type { AuthenticatedClient } from '../auth/index.js';
import { RoomRegistry } from './room-registry.js';
import { YjsDocumentStore } from './yjs-document-store.js';
import { YjsSyncHandler } from './yjs-sync.handler.js';

/** Encode a SyncStep1 message for a given doc */
function encodeSyncStep1(doc: Y.Doc): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, 0); // messageSync
  syncProtocol.writeSyncStep1(encoder, doc);
  return encoding.toUint8Array(encoder);
}

function fakeClient(userId: string): AuthenticatedClient {
  return {
    user: { sub: userId, roomId: 'room-1', role: 'candidate', type: 'collab', iat: 0, exp: 0 },
    close: vi.fn(),
    send: vi.fn(),
  } as unknown as AuthenticatedClient;
}

describe('YjsSyncHandler', () => {
  function setup() {
    const docStore = new YjsDocumentStore();
    const roomRegistry = new RoomRegistry();
    const handler = new YjsSyncHandler(docStore, roomRegistry);
    return { docStore, roomRegistry, handler };
  }

  describe('sendInitialSync', () => {
    it('GIVEN room with doc WHEN sendInitialSync THEN sends binary SyncStep1 to client with first byte 0', () => {
      const { docStore, handler } = setup();
      docStore.createDoc('room-1', 'hello');
      const client = fakeClient('user-1');

      handler.sendInitialSync('room-1', client);

      expect(client.send).toHaveBeenCalledOnce();
      const sent = (client.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as Uint8Array;
      expect(sent).toBeInstanceOf(Uint8Array);
      expect(sent[0]).toBe(0); // messageSync
    });

    it('GIVEN no doc for room WHEN sendInitialSync THEN does nothing', () => {
      const { handler } = setup();
      const client = fakeClient('user-1');

      handler.sendInitialSync('room-1', client);

      expect(client.send).not.toHaveBeenCalled();
    });
  });

  describe('handleSyncMessage', () => {
    it('GIVEN client sends SyncStep1 WHEN handleSyncMessage THEN server responds with SyncStep2 (first two bytes 0,1)', () => {
      const { docStore, roomRegistry, handler } = setup();
      docStore.createDoc('room-1', 'existing content');
      roomRegistry.createRoom('room-1');

      const client = fakeClient('user-1');
      roomRegistry.addClient('room-1', 'user-1', client);

      // Encode a SyncStep1 from a fresh client doc
      const clientDoc = new Y.Doc();
      const syncStep1 = encodeSyncStep1(clientDoc);

      handler.handleSyncMessage('room-1', 'user-1', syncStep1);

      expect(client.send).toHaveBeenCalledOnce();
      const response = (client.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as Uint8Array;
      expect(response).toBeInstanceOf(Uint8Array);
      expect(response[0]).toBe(0); // messageSync
      expect(response[1]).toBe(1); // SyncStep2 sub-type

      clientDoc.destroy();
    });

    it('GIVEN no doc for room WHEN handleSyncMessage THEN does nothing', () => {
      const { roomRegistry, handler } = setup();
      roomRegistry.createRoom('room-1');
      const client = fakeClient('user-1');
      roomRegistry.addClient('room-1', 'user-1', client);

      const clientDoc = new Y.Doc();
      const syncStep1 = encodeSyncStep1(clientDoc);

      handler.handleSyncMessage('room-1', 'user-1', syncStep1);

      expect(client.send).not.toHaveBeenCalled();
      clientDoc.destroy();
    });
  });

  describe('registerUpdateBroadcast', () => {
    it('GIVEN two clients WHEN one applies update THEN other client receives broadcast but origin does not', () => {
      const { docStore, roomRegistry, handler } = setup();
      const doc = docStore.createDoc('room-1');
      roomRegistry.createRoom('room-1');

      const client1 = fakeClient('user-1');
      const client2 = fakeClient('user-2');
      roomRegistry.addClient('room-1', 'user-1', client1);
      roomRegistry.addClient('room-1', 'user-2', client2);

      handler.registerUpdateBroadcast('room-1');

      // Simulate user-1 making an edit
      doc.transact(() => {
        doc.getText('code').insert(0, 'test');
      }, 'user-1');

      // user-2 should receive the broadcast
      expect(client2.send).toHaveBeenCalledOnce();
      const broadcast = (client2.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as Uint8Array;
      expect(broadcast).toBeInstanceOf(Uint8Array);
      expect(broadcast[0]).toBe(0); // messageSync
      expect(broadcast[1]).toBe(2); // Update sub-type

      // user-1 (origin) should NOT receive the broadcast
      expect(client1.send).not.toHaveBeenCalled();
    });
  });
});
