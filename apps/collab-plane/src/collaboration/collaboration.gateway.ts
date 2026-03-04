import { NotImplementedException } from '@nestjs/common';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { WebSocket } from 'ws';

@WebSocketGateway()
export class CollaborationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  handleConnection(_client: WebSocket): void {
    throw new NotImplementedException();
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
