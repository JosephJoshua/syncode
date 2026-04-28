import {
  type ChatHistoryEventData,
  type ChatMarkReadEventData,
  type ChatMessageCreatedEventData,
  type ChatReactionUpdatedEventData,
  type ChatReactToggleEventData,
  type ChatReadUpdatedEventData,
  type ChatSendEventData,
  COLLAB_WS_EVENTS,
  type CollabWsMessage,
  type EditorLockEventData,
  type LanguageChangeEventData,
  type ParticipantReadyEventData,
  type PhaseChangeEventData,
  type RoomStateEventData,
  WsCloseCode,
  WsMessageType,
} from '@syncode/contracts';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';

export type CollabConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

/**
 * Y.Text key used by the collab-plane's YjsDocumentStore for the given language.
 * Must match the server's per-language code key format.
 */
export const codeTextKey = (language: string): string => `code:${language}`;

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
  onLanguageChange?: (language: string, changedBy: string | null) => void;
  /**
   * Fires AFTER status transitions to `connected` from a prior `reconnecting`
   * state — never on the initial `connecting → connected` transition.
   * Used to trigger idempotent backend reactivation (e.g. re-hit POST /join).
   */
  onReconnected?: () => void;
  onChatHistory: (data: ChatHistoryEventData) => void;
  onChatMessageCreated: (data: ChatMessageCreatedEventData) => void;
  onChatReactionUpdated: (data: ChatReactionUpdatedEventData) => void;
  onChatReadUpdated: (data: ChatReadUpdatedEventData) => void;
  onRoomNotFound?: () => Promise<void>;
}

const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

const TERMINAL_CLOSE_CODES: ReadonlySet<number> = new Set([
  WsCloseCode.UNAUTHORIZED,
  WsCloseCode.KICKED,
  WsCloseCode.ALREADY_CONNECTED,
  WsCloseCode.ROOM_CLOSED,
]);

function isTerminalClose(code: number): boolean {
  if (code === 1000) return true;
  return TERMINAL_CLOSE_CODES.has(code);
}

export class YjsCollabProvider {
  readonly doc: Y.Doc;
  readonly awareness: awarenessProtocol.Awareness;

  private ws: WebSocket | null = null;
  private disposed = false;
  private backoffMs = INITIAL_BACKOFF_MS;
  private hasConnected = false;
  private hasSentSyncStep1 = false;
  private isAwaitingConnectionSync = false;
  private currentStatus: CollabConnectionStatus = 'disconnected';
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

    this.hasSentSyncStep1 = false;
    this.isAwaitingConnectionSync = true;
    this.setStatus(this.hasConnected ? 'reconnecting' : 'connecting');

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

      if (isTerminalClose(event.code)) {
        this.setStatus('disconnected');
        return;
      }

      this.setStatus('reconnecting');

      if (event.code === WsCloseCode.ROOM_NOT_FOUND && this.options.onRoomNotFound) {
        this.scheduleRoomNotFoundRecovery();
        return;
      }

      this.scheduleReconnect();
    };

    ws.onerror = () => {};
  }

  private scheduleReconnect(): void {
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.backoffMs);
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
  }

  private scheduleRoomNotFoundRecovery(): void {
    const callback = this.options.onRoomNotFound;
    if (!callback) {
      this.scheduleReconnect();
      return;
    }

    callback().then(
      () => {
        if (this.disposed) return;
        this.backoffMs = INITIAL_BACKOFF_MS;
        this.connect();
      },
      (error) => {
        if (this.disposed) return;
        console.warn('[collab] onRoomNotFound callback rejected, retrying with backoff', error);
        this.scheduleReconnect();
      },
    );
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

  sendChatMessage(data: ChatSendEventData): void {
    this.sendText(COLLAB_WS_EVENTS.CHAT_SEND, data);
  }

  toggleChatReaction(data: ChatReactToggleEventData): void {
    this.sendText(COLLAB_WS_EVENTS.CHAT_REACT_TOGGLE, data);
  }

  markChatRead(data: ChatMarkReadEventData): void {
    this.sendText(COLLAB_WS_EVENTS.CHAT_MARK_READ, data);
  }

  private send(data: Uint8Array): void {
    if (!this.disposed && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  private sendText(type: string, data: unknown): void {
    if (!this.disposed && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }));
    }
  }

  private setStatus(status: CollabConnectionStatus): void {
    if (status === this.currentStatus) return;
    this.currentStatus = status;
    this.options.onConnectionStatusChange(status);
  }

  private handleTextMessage(raw: string): void {
    let message: CollabWsMessage;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }

    this.backoffMs = INITIAL_BACKOFF_MS;
    // On the very first connect we gate the 'connected' status on the
    // initial sync round-trip (handled in handleSyncMessage when
    // isAwaitingConnectionSync is true). On reconnect, hasConnected is
    // already true and a text frame is sufficient evidence that the new WS
    // is healthy, so we transition reconnecting → connected here and fire
    // onReconnected. We mark hasConnected on the first text frame so future
    // opens after a transient close are treated as reconnects.
    if (this.hasConnected) {
      const wasReconnecting = this.currentStatus === 'reconnecting';
      this.isAwaitingConnectionSync = false;
      this.setStatus('connected');
      if (wasReconnecting) {
        // Fire AFTER the status change so subscribers observe the final state.
        this.options.onReconnected?.();
      }
    } else {
      this.hasConnected = true;
      this.awareness.setLocalStateField('user', this.options.user);
    }

    switch (message.type) {
      case COLLAB_WS_EVENTS.ROOM_STATE: {
        const data = message.data as RoomStateEventData;
        this.options.onRoomStatePatch({
          status: data.phase,
          editorLocked: data.editorLocked,
        });
        this.sendInitialSyncStep1();
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
      case COLLAB_WS_EVENTS.LANGUAGE_CHANGE: {
        const data = message.data as LanguageChangeEventData;
        this.options.onLanguageChange?.(data.language, data.changedBy);
        break;
      }
      case COLLAB_WS_EVENTS.CHAT_HISTORY: {
        const data = message.data as ChatHistoryEventData;
        this.options.onChatHistory(data);
        break;
      }
      case COLLAB_WS_EVENTS.CHAT_MESSAGE_CREATED: {
        const data = message.data as ChatMessageCreatedEventData;
        this.options.onChatMessageCreated(data);
        break;
      }
      case COLLAB_WS_EVENTS.CHAT_REACTION_UPDATED: {
        const data = message.data as ChatReactionUpdatedEventData;
        this.options.onChatReactionUpdated(data);
        break;
      }
      case COLLAB_WS_EVENTS.CHAT_READ_UPDATED: {
        const data = message.data as ChatReadUpdatedEventData;
        this.options.onChatReadUpdated(data);
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
    const syncMessageType = message[1];
    const decoder = decoding.createDecoder(message);
    decoding.readVarUint(decoder);

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, WsMessageType.SYNC);

    syncProtocol.readSyncMessage(decoder, encoder, this.doc, this);

    if (this.isAwaitingConnectionSync && (syncMessageType === 1 || syncMessageType === 2)) {
      this.isAwaitingConnectionSync = false;
      this.hasConnected = true;
      this.awareness.setLocalStateField('user', this.options.user);
      this.setStatus('connected');
    }

    if (encoding.length(encoder) > 1) {
      this.send(encoding.toUint8Array(encoder));
    }
  }

  private sendInitialSyncStep1(): void {
    if (this.hasSentSyncStep1) {
      return;
    }

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, WsMessageType.SYNC);
    syncProtocol.writeSyncStep1(encoder, this.doc);
    this.send(encoding.toUint8Array(encoder));
    this.hasSentSyncStep1 = true;
  }

  private handleAwarenessMessage(message: Uint8Array): void {
    const decoder = decoding.createDecoder(message);
    decoding.readVarUint(decoder);
    const payload = decoding.readVarUint8Array(decoder);
    awarenessProtocol.applyAwarenessUpdate(this.awareness, payload, null);
  }

  private readonly handleDocUpdate = (update: Uint8Array, origin: unknown): void => {
    if (this.disposed || origin === this) return;

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, WsMessageType.SYNC);
    syncProtocol.writeUpdate(encoder, update);
    this.send(encoding.toUint8Array(encoder));
  };

  private readonly handleAwarenessUpdate = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ): void => {
    if (this.disposed || origin !== 'local') return;

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
