import type { IncomingMessage } from 'node:http';
import { Logger, NotImplementedException } from '@nestjs/common';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { WebSocket } from 'ws';
import type { AuthenticatedClient } from '../auth/index.js';
import { WsAuthService } from '../auth/index.js';
import { CollaborationService } from './collaboration.service.js';
import { RoomRegistry } from './room-registry.js';
import { WsCloseCode } from './ws-close-codes.js';
import type { JoinMessageData, WsMessage } from './ws-message.types.js';

@WebSocketGateway()
export class CollaborationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(CollaborationGateway.name);

  constructor(
    private readonly wsAuthService: WsAuthService,
    private readonly roomRegistry: RoomRegistry,
    private readonly collaborationService: CollaborationService,
  ) {}

  async handleConnection(client: WebSocket, request: IncomingMessage): Promise<void> {
    try {
      const payload = await this.wsAuthService.authenticate(request);
      (client as AuthenticatedClient).user = payload;
      this.logger.log(`Client connected: userId=${payload.sub}, roomId=${payload.roomId}`);
    } catch {
      client.close(WsCloseCode.UNAUTHORIZED, 'Unauthorized');
    }
  }

  handleDisconnect(client: WebSocket): void {
    const authenticated = client as AuthenticatedClient;
    if (!authenticated.user) {
      return;
    }

    const { sub: userId, roomId } = authenticated.user;
    const removed = this.roomRegistry.removeClient(roomId, userId);

    if (removed) {
      this.logger.log(`Client disconnected: userId=${userId}, roomId=${roomId}`);
      this.collaborationService.notifyUserDisconnected({
        roomId,
        userId,
        timestamp: Date.now(),
      });
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
      client.close(WsCloseCode.ALREADY_CONNECTED, 'Already connected');
      return;
    }

    this.roomRegistry.addClient(roomId, userId, authenticated);
    this.logger.log(`User ${userId} joined room ${roomId}`);

    const roomState: WsMessage = {
      type: 'room-state',
      data: {
        phase: 'waiting',
        editorLocked: false,
      },
      timestamp: Date.now(),
    };
    client.send(JSON.stringify(roomState));
  }

  @SubscribeMessage('sync')
  handleSync(_client: WebSocket, _data: unknown): void {
    throw new NotImplementedException();
  }

  @SubscribeMessage('awareness')
  handleAwareness(_client: WebSocket, _data: unknown): void {
    throw new NotImplementedException();
  }
}
