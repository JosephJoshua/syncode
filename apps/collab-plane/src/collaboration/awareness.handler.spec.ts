import * as encoding from 'lib0/encoding';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as Y from 'yjs';
import type { AuthenticatedClient } from '../auth/index.js';
import { AwarenessHandler } from './awareness.handler.js';
import { RoomRegistry } from './room-registry.js';
import { YjsDocumentStore } from './yjs-document-store.js';

function fakeClient(userId: string): AuthenticatedClient {
  return {
    user: { sub: userId, roomId: 'room-1', role: 'candidate', type: 'collab', iat: 0, exp: 0 },
    close: vi.fn(),
    send: vi.fn(),
  } as unknown as AuthenticatedClient;
}

/**
 * Build a minimal awareness update message in Yjs wire format:
 * [1 (messageAwareness), awarenessProtocol.encodeAwarenessUpdate(...)]
 */
function encodeAwarenessMessage(
  awareness: awarenessProtocol.Awareness,
  clientIds: number[],
): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, 1); // messageAwareness
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

  // Ensure all awareness instances are destroyed after each test to prevent hanging timers
  afterEach(() => {
    try {
      handler.destroyRoom('room-1');
    } catch {
      // ignore if already destroyed or never created
    }
  });

  describe('createRoom', () => {
    it('GIVEN doc exists WHEN createRoom THEN creates awareness without throwing', () => {
      setup();
      docStore.createDoc('room-1');

      expect(() => handler.createRoom('room-1')).not.toThrow();

      // Verify we can clean up without error
      expect(() => handler.destroyRoom('room-1')).not.toThrow();
    });

    it('GIVEN no doc WHEN createRoom THEN does nothing (no error)', () => {
      setup();

      expect(() => handler.createRoom('room-1')).not.toThrow();
    });
  });

  describe('sendFullAwareness', () => {
    it('GIVEN room with no awareness states WHEN sendFullAwareness THEN does not send', () => {
      setup();
      docStore.createDoc('room-1');
      handler.createRoom('room-1');

      const client = fakeClient('user-1');
      handler.sendFullAwareness('room-1', client);

      expect(client.send).not.toHaveBeenCalled();
    });

    it('GIVEN non-existent room WHEN sendFullAwareness THEN does not send', () => {
      setup();
      const client = fakeClient('user-1');

      handler.sendFullAwareness('room-1', client);

      expect(client.send).not.toHaveBeenCalled();
    });
  });

  describe('removeClient', () => {
    it('GIVEN tracked clientId with awareness state WHEN removeClient THEN broadcasts removal to other clients', () => {
      setup();
      docStore.createDoc('room-1');
      roomRegistry.createRoom('room-1');
      handler.createRoom('room-1');

      const client1 = fakeClient('user-1');
      const client2 = fakeClient('user-2');
      roomRegistry.addClient('room-1', 'user-1', client1);
      roomRegistry.addClient('room-1', 'user-2', client2);

      // Create a real awareness update from a client doc so the awareness
      // instance actually has state to remove.
      const clientDoc = new Y.Doc();
      const clientAwareness = new awarenessProtocol.Awareness(clientDoc);
      clientAwareness.setLocalState({ cursor: { x: 1, y: 1 } });
      const message = encodeAwarenessMessage(clientAwareness, [clientDoc.clientID]);

      handler.handleAwarenessMessage('room-1', 'user-1', message);

      // Reset send counts so we only count removal broadcasts
      (client1.send as ReturnType<typeof vi.fn>).mockClear();
      (client2.send as ReturnType<typeof vi.fn>).mockClear();

      handler.removeClient('room-1', 'user-1');

      // client2 should receive the awareness removal broadcast (null origin = broadcast to ALL)
      expect(client2.send).toHaveBeenCalled();
      const sent = (client2.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as Uint8Array;
      expect(sent).toBeInstanceOf(Uint8Array);
      expect(sent[0]).toBe(1); // messageAwareness

      clientAwareness.destroy();
      clientDoc.destroy();
    });
  });

  describe('destroyRoom', () => {
    it('GIVEN existing room WHEN destroyRoom THEN cleans up without error', () => {
      setup();
      docStore.createDoc('room-1');
      handler.createRoom('room-1');

      expect(() => handler.destroyRoom('room-1')).not.toThrow();
    });

    it('GIVEN non-existent room WHEN destroyRoom THEN does nothing (no error)', () => {
      setup();

      expect(() => handler.destroyRoom('room-1')).not.toThrow();
    });
  });

  describe('handleAwarenessMessage', () => {
    it('GIVEN two rapid calls WHEN handleAwarenessMessage THEN second one is dropped (throttle)', () => {
      setup();
      docStore.createDoc('room-1');
      roomRegistry.createRoom('room-1');
      handler.createRoom('room-1');

      const client1 = fakeClient('user-1');
      const client2 = fakeClient('user-2');
      roomRegistry.addClient('room-1', 'user-1', client1);
      roomRegistry.addClient('room-1', 'user-2', client2);

      // Create a separate doc to generate a valid awareness update
      const clientDoc = new Y.Doc();
      const clientAwareness = new awarenessProtocol.Awareness(clientDoc);
      clientAwareness.setLocalState({ cursor: { x: 1, y: 1 } });

      const message = encodeAwarenessMessage(clientAwareness, [clientDoc.clientID]);

      // First call should go through
      handler.handleAwarenessMessage('room-1', 'user-1', message);
      const firstCallCount = (client2.send as ReturnType<typeof vi.fn>).mock.calls.length;

      // Second call within 50ms should be throttled
      handler.handleAwarenessMessage('room-1', 'user-1', message);
      const secondCallCount = (client2.send as ReturnType<typeof vi.fn>).mock.calls.length;

      // No new broadcasts should have been sent
      expect(secondCallCount).toBe(firstCallCount);

      clientAwareness.destroy();
      clientDoc.destroy();
    });
  });
});
