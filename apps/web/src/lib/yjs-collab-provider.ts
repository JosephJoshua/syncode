import {
  COLLAB_WS_EVENTS,
  type CollabWsMessage,
  type EditorLockEventData,
  type ParticipantReadyEventData,
  type PhaseChangeEventData,
  type RoomStateEventData,
  WsMessageType,
} from '@syncode/contracts';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';

export type CollabConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface YjsCollabProviderOptions {
  url: string;
  token: string;
  roomId: string;
  user: { name: string; color: string; colorLight: string };
  onConnectionStatusChange: (status: CollabConnectionStatus) => void;
  onRoomStatePatch: (patch: { status?: string; editorLocked?: boolean }) => void;
  onParticipantReady: (userId: string, isReady: boolean) => void;
  onPhaseChange: (phase: string, previousPhase: string) => void;
  onEditorLock: (locked: boolean, lockedBy: string | null) => void;
}

const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

function shouldReconnect(code: number): boolean {
  return code !== 1000 && code < 4000;
}

export class YjsCollabProvider {
  readonly doc: Y.Doc;
  readonly awareness: awarenessProtocol.Awareness;

  private ws: WebSocket | null = null;
  private disposed = false;
  private backoffMs = INITIAL_BACKOFF_MS;
  private hasConnected = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly options: YjsCollabProviderOptions;

  constructor(options: YjsCollabProviderOptions) {
    this.options = options;
    this.doc = new Y.Doc();
    this.awareness = new awarenessProtocol.Awareness(this.doc);

    this.awareness.setLocalStateField('user', options.user);

    this.doc.on('update', this.handleDocUpdate);
    this.awareness.on('update', this.handleAwarenessUpdate);
  }

  connect(): void {
    if (this.disposed) return;

    this.options.onConnectionStatusChange(this.hasConnected ? 'reconnecting' : 'connecting');

    const url = new URL(this.options.url);
    if (url.protocol === 'https:') url.protocol = 'wss:';
    else if (url.protocol === 'http:') url.protocol = 'ws:';
    url.searchParams.set('token', this.options.token);

    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', data: { roomId: this.options.roomId } }));
    };

    ws.onmessage = (event: MessageEvent) => {
      if (typeof event.data === 'string') {
        this.handleTextMessage(event.data);
      } else if (event.data instanceof ArrayBuffer) {
        this.handleBinaryMessage(new Uint8Array(event.data));
      }
    };

    ws.onclose = (event: CloseEvent) => {
      this.ws = null;
      if (this.disposed) return;

      if (!shouldReconnect(event.code)) {
        this.options.onConnectionStatusChange('disconnected');
        return;
      }

      this.options.onConnectionStatusChange('reconnecting');
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect();
      }, this.backoffMs);
      this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
    };

    ws.onerror = () => {
      // close event fires after onerror; reconnection handled there
    };
  }

  destroy(): void {
    this.disposed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    this.doc.off('update', this.handleDocUpdate);
    this.awareness.off('update', this.handleAwarenessUpdate);

    awarenessProtocol.removeAwarenessStates(this.awareness, [this.doc.clientID], null);
    this.awareness.destroy();
    this.doc.destroy();

    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      this.ws.close();
    }
  }

  private send(data: Uint8Array): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  private handleTextMessage(raw: string): void {
    this.backoffMs = INITIAL_BACKOFF_MS;
    this.hasConnected = true;
    this.options.onConnectionStatusChange('connected');

    let message: CollabWsMessage;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }

    switch (message.type) {
      case COLLAB_WS_EVENTS.ROOM_STATE: {
        const data = message.data as RoomStateEventData;
        this.options.onRoomStatePatch({
          status: data.phase,
          editorLocked: data.editorLocked,
        });
        break;
      }
      case COLLAB_WS_EVENTS.PHASE_CHANGE: {
        const data = message.data as PhaseChangeEventData;
        this.options.onPhaseChange(data.phase, data.previousPhase);
        break;
      }
      case COLLAB_WS_EVENTS.EDITOR_LOCK: {
        const data = message.data as EditorLockEventData;
        this.options.onEditorLock(data.locked, data.lockedBy);
        break;
      }
      case COLLAB_WS_EVENTS.PARTICIPANT_READY: {
        const data = message.data as ParticipantReadyEventData;
        this.options.onParticipantReady(data.userId, data.isReady);
        break;
      }
    }
  }

  private handleBinaryMessage(message: Uint8Array): void {
    if (message.length === 0) return;

    const messageType = message[0];
    if (messageType === WsMessageType.SYNC) {
      this.handleSyncMessage(message);
    } else if (messageType === WsMessageType.AWARENESS) {
      this.handleAwarenessMessage(message);
    }
  }

  private handleSyncMessage(message: Uint8Array): void {
    const decoder = decoding.createDecoder(message);
    decoding.readVarUint(decoder);

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, WsMessageType.SYNC);

    syncProtocol.readSyncMessage(decoder, encoder, this.doc, null);

    if (encoding.length(encoder) > 1) {
      this.send(encoding.toUint8Array(encoder));
    }
  }

  private handleAwarenessMessage(message: Uint8Array): void {
    const decoder = decoding.createDecoder(message);
    decoding.readVarUint(decoder);
    const payload = decoding.readVarUint8Array(decoder);
    awarenessProtocol.applyAwarenessUpdate(this.awareness, payload, null);
  }

  private handleDocUpdate = (update: Uint8Array, origin: unknown): void => {
    if (origin === null) return;

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, WsMessageType.SYNC);
    syncProtocol.writeUpdate(encoder, update);
    this.send(encoding.toUint8Array(encoder));
  };

  private handleAwarenessUpdate = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ): void => {
    if (origin !== 'local') return;

    const changedClients = added.concat(updated, removed);
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, WsMessageType.AWARENESS);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients),
    );
    this.send(encoding.toUint8Array(encoder));
  };
}
