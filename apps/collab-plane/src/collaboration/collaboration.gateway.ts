import type { IncomingMessage } from 'node:http';
import { Inject, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import {
  type ChatAttachment,
  type ChatHistoryEventData,
  type ChatMarkReadEventData,
  type ChatMention,
  type ChatReactToggleEventData,
  type ChatSendEventData,
  COLLAB_WS_EVENTS,
  CONTROL_PLANE_CALLBACK,
  type CollabWsMessage,
  type IControlPlaneCallbackClient,
  WsMessageType,
} from '@syncode/contracts';
import type { WebSocket } from 'ws';
import type { AuthenticatedClient } from '../auth/index.js';
import { WsAuthService } from '../auth/index.js';
import { AwarenessHandler } from './awareness.handler.js';
import { CollaborationService } from './collaboration.service.js';
import { RoomRegistry } from './room-registry.js';
import { WsCloseCode } from './ws-close-codes.js';
import type { JoinMessageData, WsMessage } from './ws-message.types.js';
import { YjsSyncHandler } from './yjs-sync.handler.js';

const HEARTBEAT_INTERVAL_MS = 30_000;

@WebSocketGateway()
export class CollaborationGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(CollaborationGateway.name);
  private readonly clients = new Set<WebSocket>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly wsAuthService: WsAuthService,
    private readonly roomRegistry: RoomRegistry,
    private readonly collaborationService: CollaborationService,
    private readonly syncHandler: YjsSyncHandler,
    private readonly awarenessHandler: AwarenessHandler,
    @Inject(CONTROL_PLANE_CALLBACK)
    private readonly callbackClient: IControlPlaneCallbackClient,
  ) {}

  onModuleInit(): void {
    this.heartbeatTimer = setInterval(() => this.heartbeat(), HEARTBEAT_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private heartbeat(): void {
    const batch: Array<{ roomId: string; userId: string }> = [];
    for (const client of this.clients) {
      if (client.readyState !== client.OPEN) {
        this.clients.delete(client);
        continue;
      }
      const ws = client as WebSocket & { isAlive?: boolean };
      if (ws.isAlive === false) {
        this.logger.debug('Terminating unresponsive client');
        this.clients.delete(client);
        ws.terminate();
        continue;
      }

      // Collect authenticated + currently-alive clients into the heartbeat batch
      // BEFORE we flip isAlive=false for the ping/pong round-trip.
      const authenticated = client as AuthenticatedClient;
      if (authenticated.user) {
        batch.push({
          roomId: authenticated.user.roomId,
          userId: authenticated.user.sub,
        });
      }

      ws.isAlive = false;
      ws.ping();
    }

    this.collaborationService.heartbeatParticipants(batch);
  }

  async handleConnection(client: WebSocket, request: IncomingMessage): Promise<void> {
    this.clients.add(client);
    (client as WebSocket & { isAlive?: boolean }).isAlive = true;
    client.on('pong', () => {
      (client as WebSocket & { isAlive?: boolean }).isAlive = true;
    });

    try {
      const payload = await this.wsAuthService.authenticate(request);
      (client as AuthenticatedClient).user = payload;
      this.logger.log(`Client connected: userId=${payload.sub}, roomId=${payload.roomId}`);

      client.on('message', (raw: Buffer, isBinary: boolean) => {
        if (!isBinary) return;

        const authenticated = client as AuthenticatedClient;
        if (!authenticated.user) return;

        const { roomId, sub: userId } = authenticated.user;

        // Only process binary messages from clients that completed the join handshake
        if (!this.roomRegistry.hasClient(roomId, userId)) return;

        try {
          const message = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);

          if (message[0] === WsMessageType.SYNC) {
            this.syncHandler.handleSyncMessage(roomId, userId, message);
          } else if (message[0] === WsMessageType.AWARENESS) {
            this.awarenessHandler.handleAwarenessMessage(roomId, userId, message);
          }
        } catch (error) {
          this.logger.warn(
            `Failed to process binary message from userId=${userId}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      });
    } catch {
      client.close(WsCloseCode.UNAUTHORIZED, 'Unauthorized');
    }
  }

  handleDisconnect(client: WebSocket): void {
    this.clients.delete(client);
    const authenticated = client as AuthenticatedClient;
    if (!authenticated.user) {
      return;
    }

    const { sub: userId, roomId } = authenticated.user;
    const removed = this.roomRegistry.removeClient(roomId, userId);

    if (removed) {
      this.awarenessHandler.removeClient(roomId, userId);
      this.logger.log(`Client disconnected: userId=${userId}, roomId=${roomId}`);
      this.collaborationService.notifyUserDisconnected({
        roomId,
        userId,
        timestamp: Date.now(),
      });
      this.collaborationService.checkRoomEmpty(roomId);
    }
  }

  @SubscribeMessage('join')
  async handleJoin(client: WebSocket, data: JoinMessageData): Promise<void> {
    const authenticated = client as AuthenticatedClient;
    if (!authenticated.user) {
      client.close(WsCloseCode.UNAUTHORIZED, 'Unauthorized');
      return;
    }

    const { sub: userId, roomId: tokenRoomId } = authenticated.user;

    if (!data || typeof data.roomId !== 'string') {
      client.close(WsCloseCode.UNAUTHORIZED, 'Invalid join payload');
      return;
    }

    const { roomId } = data;

    if (roomId !== tokenRoomId) {
      this.logger.warn(`Room ID mismatch: token=${tokenRoomId}, join=${roomId}, userId=${userId}`);
      client.close(WsCloseCode.UNAUTHORIZED, 'Room ID mismatch');
      return;
    }

    if (!this.roomRegistry.hasRoom(roomId)) {
      client.close(WsCloseCode.ROOM_NOT_FOUND, 'Room not found');
      return;
    }

    // Authoritative re-check against control-plane. The collab JWT is long-lived
    // (24h), so a kicked user may still hold a valid token. The in-memory room
    // registry has no kick history, so without this we would let them back in.
    const decision = await this.callbackClient.authorizeJoin(roomId, userId);
    if (!decision.authorized) {
      this.logger.warn(
        `Join denied for userId=${userId}, roomId=${roomId}: reason=${decision.reason ?? 'unknown'}`,
      );
      client.close(WsCloseCode.FORBIDDEN, decision.reason ?? 'Join denied');
      return;
    }

    if (this.roomRegistry.hasClient(roomId, userId)) {
      // Evict the stale connection — the new one replaces it.
      // This handles reconnection races where the old socket hasn't
      // fired handleDisconnect yet.
      const stale = this.roomRegistry.getClient(roomId, userId);
      this.roomRegistry.removeClient(roomId, userId);
      this.awarenessHandler.removeClient(roomId, userId);
      stale?.close(WsCloseCode.ALREADY_CONNECTED, 'Replaced by new connection');
      this.logger.log(`Evicted stale connection for userId=${userId} in room ${roomId}`);
    }

    this.roomRegistry.addClient(roomId, userId, authenticated);
    this.collaborationService.cancelRoomCleanup(roomId);
    this.logger.log(`User ${userId} joined room ${roomId}`);

    const room = this.roomRegistry.getRoom(roomId);
    const roomState: WsMessage = {
      type: COLLAB_WS_EVENTS.ROOM_STATE,
      data: {
        phase: room?.phase ?? 'waiting',
        editorLocked: room?.editorLocked ?? false,
      },
      timestamp: Date.now(),
    };
    client.send(JSON.stringify(roomState));

    const chatHistory: WsMessage<ChatHistoryEventData> = {
      type: COLLAB_WS_EVENTS.CHAT_HISTORY,
      data: {
        messages: this.roomRegistry.listChatMessages(roomId),
        readStates: this.roomRegistry.listChatReadStates(roomId),
      },
      timestamp: Date.now(),
    };
    client.send(JSON.stringify(chatHistory));

    this.syncHandler.sendInitialSync(roomId, authenticated);
    this.awarenessHandler.sendFullAwareness(roomId, authenticated);
  }

  @SubscribeMessage(COLLAB_WS_EVENTS.CHAT_SEND)
  handleChatSend(client: WebSocket, data: ChatSendEventData): void {
    const authenticated = this.getAuthenticatedRoomClient(client);
    if (!authenticated) {
      return;
    }

    const text = typeof data?.text === 'string' ? data.text.trim() : '';
    const mentions = this.normalizeMentions(data?.mentions);
    const attachments = this.normalizeAttachments(data?.attachments);

    if (text.length === 0 && attachments.length === 0) {
      return;
    }

    try {
      const message = this.roomRegistry.createChatMessage(authenticated.user.roomId, {
        userId: authenticated.user.sub,
        text,
        replyToMessageId: typeof data?.replyToMessageId === 'string' ? data.replyToMessageId : null,
        mentions,
        attachments,
      });

      this.broadcastToRoom(authenticated.user.roomId, {
        type: COLLAB_WS_EVENTS.CHAT_MESSAGE_CREATED,
        data: { message },
        timestamp: Date.now(),
      });

      const senderRead = this.roomRegistry.markChatRead(authenticated.user.roomId, {
        userId: authenticated.user.sub,
        upTo: message.createdAt,
      });
      this.broadcastToRoom(authenticated.user.roomId, {
        type: COLLAB_WS_EVENTS.CHAT_READ_UPDATED,
        data: senderRead,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.debug(
        `Ignoring chat send failure in room ${authenticated.user.roomId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  @SubscribeMessage(COLLAB_WS_EVENTS.CHAT_MARK_READ)
  handleChatMarkRead(client: WebSocket, data: ChatMarkReadEventData): void {
    const authenticated = this.getAuthenticatedRoomClient(client);
    if (!authenticated) {
      return;
    }

    try {
      const updated = this.roomRegistry.markChatRead(authenticated.user.roomId, {
        userId: authenticated.user.sub,
        upTo: typeof data?.upTo === 'number' ? data.upTo : undefined,
      });

      this.broadcastToRoom(authenticated.user.roomId, {
        type: COLLAB_WS_EVENTS.CHAT_READ_UPDATED,
        data: updated,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.debug(
        `Ignoring chat mark-read failure in room ${authenticated.user.roomId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  @SubscribeMessage(COLLAB_WS_EVENTS.CHAT_REACT_TOGGLE)
  handleChatReactToggle(client: WebSocket, data: ChatReactToggleEventData): void {
    const authenticated = this.getAuthenticatedRoomClient(client);
    if (!authenticated) {
      return;
    }

    const messageId = typeof data?.messageId === 'string' ? data.messageId : '';
    const emoji = typeof data?.emoji === 'string' ? data.emoji.trim() : '';
    if (messageId.length === 0 || emoji.length === 0) {
      return;
    }

    try {
      const updated = this.roomRegistry.toggleChatReaction(authenticated.user.roomId, {
        messageId,
        emoji,
        userId: authenticated.user.sub,
      });

      this.broadcastToRoom(authenticated.user.roomId, {
        type: COLLAB_WS_EVENTS.CHAT_REACTION_UPDATED,
        data: updated,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.debug(
        `Ignoring chat reaction toggle failure in room ${authenticated.user.roomId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private getAuthenticatedRoomClient(client: WebSocket): AuthenticatedClient | null {
    const authenticated = client as AuthenticatedClient;
    if (!authenticated.user) {
      client.close(WsCloseCode.UNAUTHORIZED, 'Unauthorized');
      return null;
    }

    const { roomId, sub: userId } = authenticated.user;
    if (!this.roomRegistry.hasClient(roomId, userId)) {
      return null;
    }

    return authenticated;
  }

  private broadcastToRoom(roomId: string, message: CollabWsMessage): void {
    const room = this.roomRegistry.getRoom(roomId);
    if (!room) {
      return;
    }

    const serialized = JSON.stringify(message);
    for (const socket of room.clients.values()) {
      socket.send(serialized);
    }
  }

  private normalizeMentions(raw: unknown): ChatMention[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw
      .map((item) => {
        if (typeof item !== 'object' || item === null) {
          return null;
        }

        const mention = item as { kind?: string; value?: string; userId?: string };
        if (
          (mention.kind !== 'user' && mention.kind !== 'ai') ||
          typeof mention.value !== 'string'
        ) {
          return null;
        }

        const value = mention.value.trim();
        if (!value) {
          return null;
        }

        return {
          kind: mention.kind,
          value,
          ...(typeof mention.userId === 'string' && mention.userId.length > 0
            ? { userId: mention.userId }
            : {}),
        } satisfies ChatMention;
      })
      .filter((mention): mention is ChatMention => mention !== null);
  }

  private normalizeAttachments(raw: unknown): ChatAttachment[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw
      .map((item) => {
        if (typeof item !== 'object' || item === null) {
          return null;
        }

        const attachment = item as {
          kind?: string;
          key?: string;
          url?: string;
          fileName?: string;
          mimeType?: string;
          sizeBytes?: number;
        };

        if (!['image', 'video', 'audio', 'file'].includes(String(attachment.kind))) {
          return null;
        }
        if (
          typeof attachment.key !== 'string' ||
          typeof attachment.url !== 'string' ||
          typeof attachment.fileName !== 'string' ||
          typeof attachment.mimeType !== 'string' ||
          typeof attachment.sizeBytes !== 'number'
        ) {
          return null;
        }
        if (attachment.sizeBytes <= 0) {
          return null;
        }

        return {
          kind: attachment.kind as ChatAttachment['kind'],
          key: attachment.key,
          url: attachment.url,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
        } satisfies ChatAttachment;
      })
      .filter((attachment): attachment is ChatAttachment => attachment !== null);
  }
}
