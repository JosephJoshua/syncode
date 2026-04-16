import type { IncomingMessage } from 'node:http';
import { Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { COLLAB_WS_EVENTS, WsMessageType } from '@syncode/contracts';
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
      ws.isAlive = false;
      ws.ping();
    }
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
  handleJoin(client: WebSocket, data: JoinMessageData): void {
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

    this.syncHandler.sendInitialSync(roomId, authenticated);
    this.awarenessHandler.sendFullAwareness(roomId, authenticated);
  }
}
