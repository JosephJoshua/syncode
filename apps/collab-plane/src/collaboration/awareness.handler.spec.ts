import * as encoding from 'lib0/encoding';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as Y from 'yjs';
import type { AuthenticatedClient } from '../auth/index.js';
import { AwarenessHandler } from './awareness.handler.js';
import { RoomRegistry } from './room-registry.js';
import { WsMessageType } from './ws-message-types.js';
import { YjsDocumentStore } from './yjs-document-store.js';

function fakeClient(userId: string): AuthenticatedClient {
  return {
    user: { sub: userId, roomId: 'room-1', role: 'candidate', type: 'collab', iat: 0, exp: 0 },
    close: vi.fn(),
    send: vi.fn(),
  } as unknown as AuthenticatedClient;
}

function encodeAwarenessMessage(
  awareness: awarenessProtocol.Awareness,
  clientIds: number[],
): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, WsMessageType.AWARENESS);
  encoding.writeVarUint8Array(
    encoder,
    awarenessProtocol.encodeAwarenessUpdate(awareness, clientIds),
  );
  return encoding.toUint8Array(encoder);
}

describe('AwarenessHandler', () => {
  let docStore: YjsDocumentStore;
  let roomRegistry: RoomRegistry;
  let handler: AwarenessHandler;

  function setup() {
    docStore = new YjsDocumentStore();
    roomRegistry = new RoomRegistry();
    handler = new AwarenessHandler(docStore, roomRegistry);
    return { docStore, roomRegistry, handler };
  }

  afterEach(() => {
    try {
      handler.destroyRoom('room-1');
    } catch {
      // ignore if already destroyed
    }
  });

  describe('handleAwarenessMessage', () => {
    it('GIVEN two clients WHEN user-1 sends awareness THEN user-2 receives the broadcast', () => {
      setup();
      docStore.createDoc('room-1');
      roomRegistry.createRoom('room-1');
      handler.createRoom('room-1');

      const client1 = fakeClient('user-1');
      const client2 = fakeClient('user-2');
      roomRegistry.addClient('room-1', 'user-1', client1);
      roomRegistry.addClient('room-1', 'user-2', client2);

      const clientDoc = new Y.Doc();
      const clientAwareness = new awarenessProtocol.Awareness(clientDoc);
      clientAwareness.setLocalState({ cursor: { x: 10, y: 20 } });
      const message = encodeAwarenessMessage(clientAwareness, [clientDoc.clientID]);

      handler.handleAwarenessMessage('room-1', 'user-1', message);

      expect(client2.send).toHaveBeenCalled();
      const sent = (client2.send as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Uint8Array;
      expect(sent[0]).toBe(WsMessageType.AWARENESS);
      expect(client1.send).not.toHaveBeenCalled();

      clientAwareness.destroy();
      clientDoc.destroy();
    });

    it('GIVEN two rapid calls within 50ms WHEN handling THEN second is dropped', () => {
      setup();
      docStore.createDoc('room-1');
      roomRegistry.createRoom('room-1');
      handler.createRoom('room-1');

      const client1 = fakeClient('user-1');
      const client2 = fakeClient('user-2');
      roomRegistry.addClient('room-1', 'user-1', client1);
      roomRegistry.addClient('room-1', 'user-2', client2);

      const clientDoc = new Y.Doc();
      const clientAwareness = new awarenessProtocol.Awareness(clientDoc);
      clientAwareness.setLocalState({ cursor: { x: 1, y: 1 } });
      const message = encodeAwarenessMessage(clientAwareness, [clientDoc.clientID]);

      // Pin Date.now to make the 50ms throttle deterministic
      const now = 1000;
      vi.spyOn(Date, 'now').mockImplementation(() => now);

      handler.handleAwarenessMessage('room-1', 'user-1', message);
      const firstCount = (client2.send as ReturnType<typeof vi.fn>).mock.calls.length;

      // Second call at same timestamp — within 50ms window
      handler.handleAwarenessMessage('room-1', 'user-1', message);
      const secondCount = (client2.send as ReturnType<typeof vi.fn>).mock.calls.length;

      expect(secondCount).toBe(firstCount);

      vi.restoreAllMocks();
      clientAwareness.destroy();
      clientDoc.destroy();
    });

    it('GIVEN non-existent room WHEN handling awareness THEN nothing happens', () => {
      setup();
      const clientDoc = new Y.Doc();
      const clientAwareness = new awarenessProtocol.Awareness(clientDoc);
      clientAwareness.setLocalState({ cursor: null });
      const message = encodeAwarenessMessage(clientAwareness, [clientDoc.clientID]);

      expect(() => handler.handleAwarenessMessage('room-1', 'user-1', message)).not.toThrow();

      clientAwareness.destroy();
      clientDoc.destroy();
    });
  });

  describe('sendFullAwareness', () => {
    it('GIVEN peer has awareness state WHEN new client joins THEN receives full awareness', () => {
      setup();
      docStore.createDoc('room-1');
      roomRegistry.createRoom('room-1');
      handler.createRoom('room-1');

      const client1 = fakeClient('user-1');
      roomRegistry.addClient('room-1', 'user-1', client1);

      // User-1 sets awareness state
      const clientDoc = new Y.Doc();
      const clientAwareness = new awarenessProtocol.Awareness(clientDoc);
      clientAwareness.setLocalState({ cursor: { x: 5, y: 10 } });
      const message = encodeAwarenessMessage(clientAwareness, [clientDoc.clientID]);
      handler.handleAwarenessMessage('room-1', 'user-1', message);

      // User-2 joins and requests full awareness
      const client2 = fakeClient('user-2');
      roomRegistry.addClient('room-1', 'user-2', client2);
      handler.sendFullAwareness('room-1', client2);

      expect(client2.send).toHaveBeenCalled();
      const sent = (client2.send as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Uint8Array;
      expect(sent[0]).toBe(WsMessageType.AWARENESS);

      clientAwareness.destroy();
      clientDoc.destroy();
    });

    it('GIVEN room with no awareness states WHEN sending THEN nothing is sent', () => {
      setup();
      docStore.createDoc('room-1');
      handler.createRoom('room-1');
      const client = fakeClient('user-1');

      handler.sendFullAwareness('room-1', client);

      expect(client.send).not.toHaveBeenCalled();
    });

    it('GIVEN non-existent room WHEN sending THEN nothing is sent', () => {
      setup();
      const client = fakeClient('user-1');

      handler.sendFullAwareness('room-1', client);

      expect(client.send).not.toHaveBeenCalled();
    });
  });

  describe('removeClient', () => {
    it('GIVEN user with awareness state WHEN removed THEN other clients receive removal broadcast', () => {
      setup();
      docStore.createDoc('room-1');
      roomRegistry.createRoom('room-1');
      handler.createRoom('room-1');

      const client1 = fakeClient('user-1');
      const client2 = fakeClient('user-2');
      roomRegistry.addClient('room-1', 'user-1', client1);
      roomRegistry.addClient('room-1', 'user-2', client2);

      // User-1 applies awareness
      const clientDoc = new Y.Doc();
      const clientAwareness = new awarenessProtocol.Awareness(clientDoc);
      clientAwareness.setLocalState({ cursor: { x: 1, y: 1 } });
      const message = encodeAwarenessMessage(clientAwareness, [clientDoc.clientID]);
      handler.handleAwarenessMessage('room-1', 'user-1', message);

      (client1.send as ReturnType<typeof vi.fn>).mockClear();
      (client2.send as ReturnType<typeof vi.fn>).mockClear();

      handler.removeClient('room-1', 'user-1');

      // User-2 should receive removal broadcast
      expect(client2.send).toHaveBeenCalled();
      const sent = (client2.send as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Uint8Array;
      expect(sent[0]).toBe(WsMessageType.AWARENESS);

      // After removal, sendFullAwareness should have no state for user-1
      (client2.send as ReturnType<typeof vi.fn>).mockClear();
      handler.sendFullAwareness('room-1', client2);
      // If the only state was user-1's and it was removed, nothing should be sent
      // (or user-2 would only see their own state if they had one)

      clientAwareness.destroy();
      clientDoc.destroy();
    });
  });

  describe('destroyRoom', () => {
    it('GIVEN existing room WHEN destroyed THEN cleans up without error', () => {
      setup();
      docStore.createDoc('room-1');
      handler.createRoom('room-1');

      expect(() => handler.destroyRoom('room-1')).not.toThrow();
    });

    it('GIVEN non-existent room WHEN destroyed THEN does nothing', () => {
      setup();

      expect(() => handler.destroyRoom('room-1')).not.toThrow();
    });
  });
});
