import { COLLAB_WS_EVENTS } from '@syncode/contracts';
import * as encoding from 'lib0/encoding';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';
import {
  type CollabConnectionStatus,
  codeTextKey,
  YjsCollabProvider,
} from './yjs-collab-provider.js';

// ── Mock WebSocket ──────────────────────────────────────────────────────────

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSED = 3;

  binaryType = 'blob';
  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string | ArrayBuffer }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  sent: (string | ArrayBuffer | Uint8Array)[] = [];
  url: string;

  constructor(url: string | URL) {
    this.url = typeof url === 'string' ? url : url.toString();
    MockWebSocket.instances.push(this);
  }

  send(data: string | ArrayBuffer | Uint8Array) {
    this.sent.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
  }

  // ── Test helpers ──

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  simulateTextMessage(data: string) {
    this.onmessage?.({ data });
  }

  simulateBinaryMessage(data: Uint8Array) {
    this.onmessage?.({
      data: (data.buffer as ArrayBuffer).slice(data.byteOffset, data.byteOffset + data.byteLength),
    });
  }

  simulateClose(code: number) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function defaultOptions(
  overrides: Partial<ConstructorParameters<typeof YjsCollabProvider>[0]> = {},
) {
  return {
    url: 'http://localhost:3001',
    token: 'test-token',
    roomId: 'room-1',
    user: { name: 'Alice', color: '#00e599', colorLight: '#00e59933' },
    onConnectionStatusChange: vi.fn(),
    onRoomStatePatch: vi.fn(),
    onParticipantReady: vi.fn(),
    onPhaseChange: vi.fn(),
    onEditorLock: vi.fn(),
    ...overrides,
  };
}

function latestWs(): MockWebSocket {
  return MockWebSocket.instances[MockWebSocket.instances.length - 1]!;
}

function connectProvider(opts = defaultOptions()) {
  const provider = new YjsCollabProvider(opts);
  provider.connect();
  const ws = latestWs();
  ws.simulateOpen();
  // Send a room-state text message to transition to 'connected'
  ws.simulateTextMessage(
    JSON.stringify({
      type: COLLAB_WS_EVENTS.ROOM_STATE,
      data: { phase: 'waiting', editorLocked: false },
      timestamp: Date.now(),
    }),
  );
  return { provider, ws, opts };
}

/** Build a SyncStep1 message from a server doc, as the collab-plane would send. */
function buildSyncStep1(serverDoc: Y.Doc): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, 0); // WsMessageType.SYNC
  syncProtocol.writeSyncStep1(encoder, serverDoc);
  return encoding.toUint8Array(encoder);
}

/** Build a Yjs update message wrapping a raw update. */
function buildSyncUpdate(update: Uint8Array): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, 0); // WsMessageType.SYNC
  syncProtocol.writeUpdate(encoder, update);
  return encoding.toUint8Array(encoder);
}

/** Build an awareness message as the server would send. */
function buildAwarenessMessage(
  awareness: awarenessProtocol.Awareness,
  clientIds: number[],
): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, 1); // WsMessageType.AWARENESS
  encoding.writeVarUint8Array(
    encoder,
    awarenessProtocol.encodeAwarenessUpdate(awareness, clientIds),
  );
  return encoding.toUint8Array(encoder);
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal('WebSocket', MockWebSocket);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('codeTextKey', () => {
  it('GIVEN a language WHEN called THEN returns code:<language>', () => {
    expect(codeTextKey('python')).toBe('code:python');
    expect(codeTextKey('rust')).toBe('code:rust');
    expect(codeTextKey('javascript')).toBe('code:javascript');
  });
});

describe('YjsCollabProvider', () => {
  describe('connection', () => {
    it('GIVEN http URL WHEN connecting THEN opens WebSocket with ws:// protocol and sends join message', () => {
      const opts = defaultOptions();
      const provider = new YjsCollabProvider(opts);
      provider.connect();

      const ws = latestWs();
      expect(ws.url).toContain('ws://');
      expect(ws.url).toContain('token=test-token');
      expect(ws.binaryType).toBe('arraybuffer');

      ws.simulateOpen();
      const joinMsg = JSON.parse(ws.sent[0] as string);
      expect(joinMsg).toEqual({ type: 'join', data: { roomId: 'room-1' } });

      provider.destroy();
    });

    it('GIVEN https URL WHEN connecting THEN converts to wss:// protocol', () => {
      const opts = defaultOptions({ url: 'https://collab.example.com' });
      const provider = new YjsCollabProvider(opts);
      provider.connect();

      expect(latestWs().url).toContain('wss://');

      provider.destroy();
    });
  });

  describe('status transitions', () => {
    it('GIVEN connect called THEN fires connecting, then connected on first text message, then no duplicate connected on subsequent messages', () => {
      const onStatus = vi.fn();
      const opts = defaultOptions({ onConnectionStatusChange: onStatus });
      const provider = new YjsCollabProvider(opts);

      provider.connect();
      expect(onStatus).toHaveBeenLastCalledWith('connecting');

      const ws = latestWs();
      ws.simulateOpen();

      // First text message → connected
      ws.simulateTextMessage(
        JSON.stringify({
          type: COLLAB_WS_EVENTS.ROOM_STATE,
          data: { phase: 'waiting', editorLocked: false },
          timestamp: Date.now(),
        }),
      );
      expect(onStatus).toHaveBeenCalledWith('connected');
      const callCount = onStatus.mock.calls.length;

      // Second text message → no additional call (status didn't change)
      ws.simulateTextMessage(
        JSON.stringify({
          type: COLLAB_WS_EVENTS.PHASE_CHANGE,
          data: { phase: 'coding', previousPhase: 'waiting' },
          timestamp: Date.now(),
        }),
      );
      expect(onStatus.mock.calls.length).toBe(callCount);

      provider.destroy();
    });
  });

  describe('text message routing', () => {
    it('GIVEN connected WHEN receiving different event types THEN routes each to the correct callback', () => {
      const opts = defaultOptions();
      const { provider, ws } = connectProvider(opts);

      // Already received room-state in connectProvider — verify it was routed
      expect(opts.onRoomStatePatch).toHaveBeenCalledWith({
        status: 'waiting',
        editorLocked: false,
      });

      // Phase change
      ws.simulateTextMessage(
        JSON.stringify({
          type: COLLAB_WS_EVENTS.PHASE_CHANGE,
          data: { phase: 'coding', previousPhase: 'warmup' },
          timestamp: Date.now(),
        }),
      );
      expect(opts.onPhaseChange).toHaveBeenCalledWith('coding', 'warmup');

      // Editor lock
      ws.simulateTextMessage(
        JSON.stringify({
          type: COLLAB_WS_EVENTS.EDITOR_LOCK,
          data: { locked: true, lockedBy: 'user-1' },
          timestamp: Date.now(),
        }),
      );
      expect(opts.onEditorLock).toHaveBeenCalledWith(true, 'user-1');

      // Participant ready
      ws.simulateTextMessage(
        JSON.stringify({
          type: COLLAB_WS_EVENTS.PARTICIPANT_READY,
          data: { userId: 'user-2', isReady: true },
          timestamp: Date.now(),
        }),
      );
      expect(opts.onParticipantReady).toHaveBeenCalledWith('user-2', true);

      provider.destroy();
    });

    it('GIVEN connected WHEN receiving malformed JSON THEN does not throw', () => {
      const { provider, ws } = connectProvider();
      expect(() => ws.simulateTextMessage('not json')).not.toThrow();
      provider.destroy();
    });
  });

  describe('binary sync', () => {
    it('GIVEN connected WHEN full sync handshake completes THEN client doc has server content', () => {
      const { provider, ws } = connectProvider();

      // Build a server doc with content and run the full sync handshake
      const serverDoc = new Y.Doc();
      serverDoc.getText(codeTextKey('python')).insert(0, 'hello world');

      // Step 1: server sends SyncStep1 → client responds with SyncStep2
      const sentBefore = ws.sent.length;
      ws.simulateBinaryMessage(buildSyncStep1(serverDoc));
      expect(ws.sent.length).toBeGreaterThan(sentBefore); // SyncStep2 response sent

      // Step 2: server sends its updates as a sync update
      const serverUpdate = Y.encodeStateAsUpdate(serverDoc);
      ws.simulateBinaryMessage(buildSyncUpdate(serverUpdate));

      // Client doc should now have the server's content
      expect(provider.doc.getText(codeTextKey('python')).toString()).toBe('hello world');

      serverDoc.destroy();
      provider.destroy();
    });

    it('GIVEN synced doc WHEN remote user edits THEN local doc updates without echoing the update back', () => {
      const { provider, ws } = connectProvider();

      // Simulate initial sync so docs are aligned
      const serverDoc = new Y.Doc();
      ws.simulateBinaryMessage(buildSyncStep1(serverDoc));

      // Now simulate a remote edit arriving as a sync update
      const remoteDoc = new Y.Doc();
      let capturedUpdate: Uint8Array | null = null;
      remoteDoc.on('update', (update: Uint8Array) => {
        capturedUpdate = update;
      });
      remoteDoc.getText(codeTextKey('python')).insert(0, 'remote edit');

      const sentBefore = ws.sent.length;
      ws.simulateBinaryMessage(buildSyncUpdate(capturedUpdate!));

      // Local doc should have the content
      expect(provider.doc.getText(codeTextKey('python')).toString()).toBe('remote edit');

      // Should NOT have sent anything back (echo prevention)
      // The SyncStep1 handler may have sent a response, so only check for no NEW sends
      // after the update message
      expect(ws.sent.length).toBe(sentBefore);

      serverDoc.destroy();
      remoteDoc.destroy();
      provider.destroy();
    });

    it('GIVEN connected WHEN local edit is made THEN sends sync update to server', () => {
      const { provider, ws } = connectProvider();

      const sentBefore = ws.sent.length;
      provider.doc.getText(codeTextKey('python')).insert(0, 'local edit');

      // Should have sent a sync update
      expect(ws.sent.length).toBeGreaterThan(sentBefore);

      // Verify the sent message starts with SYNC message type (0)
      const lastSent = ws.sent[ws.sent.length - 1] as Uint8Array;
      expect(lastSent[0]).toBe(0); // WsMessageType.SYNC

      provider.destroy();
    });
  });

  describe('awareness', () => {
    it('GIVEN connected WHEN server sends awareness update THEN local awareness reflects remote user state', () => {
      const { provider, ws } = connectProvider();

      // Create a remote awareness with user info
      const remoteDoc = new Y.Doc();
      const remoteAwareness = new awarenessProtocol.Awareness(remoteDoc);
      remoteAwareness.setLocalStateField('user', {
        name: 'Bob',
        color: '#60a5fa',
        colorLight: '#60a5fa33',
      });

      // Send the awareness update
      const awarenessMsg = buildAwarenessMessage(remoteAwareness, [remoteDoc.clientID]);
      ws.simulateBinaryMessage(awarenessMsg);

      // Local awareness should now know about the remote client
      const states = provider.awareness.getStates();
      const remoteState = states.get(remoteDoc.clientID);
      expect(remoteState?.user.name).toBe('Bob');

      remoteAwareness.destroy();
      remoteDoc.destroy();
      provider.destroy();
    });

    it('GIVEN constructor WHEN provider is created THEN local awareness has user info set', () => {
      const opts = defaultOptions();
      const provider = new YjsCollabProvider(opts);

      const localState = provider.awareness.getLocalState();
      expect(localState?.user).toEqual({
        name: 'Alice',
        color: '#00e599',
        colorLight: '#00e59933',
      });

      provider.destroy();
    });
  });

  describe('reconnection', () => {
    it('GIVEN connected WHEN WS closes with transient code THEN reconnects after backoff', () => {
      const onStatus = vi.fn();
      const { provider, ws } = connectProvider(
        defaultOptions({ onConnectionStatusChange: onStatus }),
      );

      ws.simulateClose(1006); // abnormal closure
      expect(onStatus).toHaveBeenCalledWith('reconnecting');

      const wsBefore = MockWebSocket.instances.length;
      vi.advanceTimersByTime(1000); // initial backoff
      expect(MockWebSocket.instances.length).toBe(wsBefore + 1);

      provider.destroy();
    });

    it('GIVEN connected WHEN WS closes with code 1000 THEN does not reconnect', () => {
      const onStatus = vi.fn();
      const { provider, ws } = connectProvider(
        defaultOptions({ onConnectionStatusChange: onStatus }),
      );

      ws.simulateClose(1000); // normal closure
      expect(onStatus).toHaveBeenCalledWith('disconnected');

      const wsBefore = MockWebSocket.instances.length;
      vi.advanceTimersByTime(60_000); // well past any backoff
      expect(MockWebSocket.instances.length).toBe(wsBefore); // no new WS created

      provider.destroy();
    });

    it('GIVEN connected WHEN WS closes with 4xxx code THEN does not reconnect', () => {
      const onStatus = vi.fn();
      const { provider, ws } = connectProvider(
        defaultOptions({ onConnectionStatusChange: onStatus }),
      );

      ws.simulateClose(4001); // server rejection
      expect(onStatus).toHaveBeenCalledWith('disconnected');

      const wsBefore = MockWebSocket.instances.length;
      vi.advanceTimersByTime(60_000);
      expect(MockWebSocket.instances.length).toBe(wsBefore);

      provider.destroy();
    });
  });

  describe('cleanup', () => {
    it('GIVEN connected WHEN destroy is called THEN closes WS and stops reconnection on subsequent close', () => {
      const { provider, ws } = connectProvider();
      provider.destroy();

      expect(ws.readyState).toBe(MockWebSocket.CLOSED);

      // Simulate a late close event — should not create new connections
      const wsBefore = MockWebSocket.instances.length;
      ws.simulateClose(1006);
      vi.advanceTimersByTime(60_000);
      expect(MockWebSocket.instances.length).toBe(wsBefore);
    });
  });
});
