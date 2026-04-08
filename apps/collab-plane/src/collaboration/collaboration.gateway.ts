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

@WebSocketGateway()
export class CollaborationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(CollaborationGateway.name);

  constructor(private readonly wsAuthService: WsAuthService) {}

  async handleConnection(client: WebSocket, request: IncomingMessage): Promise<void> {
    try {
      const payload = await this.wsAuthService.authenticate(request);
      (client as AuthenticatedClient).user = payload;
      this.logger.log(`Client connected: userId=${payload.sub}, roomId=${payload.roomId}`);
    } catch {
      client.close(4001, 'Unauthorized');
    }
  }

  handleDisconnect(_client: WebSocket): void {
    throw new NotImplementedException();
  }

  @SubscribeMessage('sync')
  handleSync(_client: WebSocket, _data: unknown): void {
    throw new NotImplementedException();
  }

  @SubscribeMessage('awareness')
  handleAwareness(_client: WebSocket, _data: unknown): void {
    throw new NotImplementedException();
  }

  @SubscribeMessage('join')
  handleJoin(_client: WebSocket, _data: unknown): void {
    throw new NotImplementedException();
  }
}
