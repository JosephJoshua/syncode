import type { IncomingMessage } from 'node:http';
import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { WebSocket } from 'ws';
import type { CollabTokenPayload } from '../auth/collab-token-payload.js';
import type { AuthenticatedClient, WsAuthService } from '../auth/index.js';
import { CollaborationGateway } from './collaboration.gateway.js';
import type { CollaborationService } from './collaboration.service.js';
import { RoomRegistry } from './room-registry.js';
import { WsCloseCode } from './ws-close-codes.js';

const VALID_PAYLOAD: CollabTokenPayload = {
  sub: 'user-1',
  roomId: 'room-1',
  role: 'candidate',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 86400,
};

function createFixture() {
  const wsAuthService = {
    authenticate: vi.fn<(request: IncomingMessage) => Promise<CollabTokenPayload>>(),
  };

  const roomRegistry = new RoomRegistry();

  const collaborationService = {
    notifyUserDisconnected: vi.fn(),
  };

  const gateway = new CollaborationGateway(
    wsAuthService as unknown as WsAuthService,
    roomRegistry,
    collaborationService as unknown as CollaborationService,
  );

  return { gateway, wsAuthService, roomRegistry, collaborationService };
}

function fakeClient(user?: CollabTokenPayload): WebSocket & { user?: CollabTokenPayload } {
  const client = {
    close: vi.fn(),
    send: vi.fn(),
    user,
  };
  return client as unknown as WebSocket & { user?: CollabTokenPayload };
}

describe('CollaborationGateway', () => {
  describe('handleConnection', () => {
    it('GIVEN valid token WHEN connecting THEN attaches user to client', async () => {
      const { gateway, wsAuthService } = createFixture();
      wsAuthService.authenticate.mockResolvedValueOnce(VALID_PAYLOAD);
      const client = fakeClient();

      await gateway.handleConnection(client as unknown as WebSocket, {} as IncomingMessage);

      expect((client as AuthenticatedClient).user).toEqual(VALID_PAYLOAD);
      expect(client.close).not.toHaveBeenCalled();
    });

    it('GIVEN invalid token WHEN connecting THEN closes with 4001', async () => {
      const { gateway, wsAuthService } = createFixture();
      wsAuthService.authenticate.mockRejectedValueOnce(new UnauthorizedException());
      const client = fakeClient();

      await gateway.handleConnection(client as unknown as WebSocket, {} as IncomingMessage);

      expect(client.close).toHaveBeenCalledWith(WsCloseCode.UNAUTHORIZED, 'Unauthorized');
    });
  });

  describe('handleJoin', () => {
    it('GIVEN valid join with matching roomId WHEN joining THEN adds client and sends room-state', () => {
      const { gateway, roomRegistry } = createFixture();
      roomRegistry.createRoom('room-1');
      const client = fakeClient(VALID_PAYLOAD);

      gateway.handleJoin(client as unknown as WebSocket, {
        roomId: 'room-1',
      });

      expect(roomRegistry.hasClient('room-1', 'user-1')).toBe(true);
      expect(client.send).toHaveBeenCalledOnce();
      const sent = JSON.parse(client.send.mock.calls[0]![0] as string);
      expect(sent.type).toBe('room-state');
      expect(sent.data).toMatchObject({ phase: 'waiting', editorLocked: false });
      expect(sent.timestamp).toBeGreaterThan(0);
    });

    it('GIVEN mismatched roomId WHEN joining THEN closes with UNAUTHORIZED', () => {
      const { gateway } = createFixture();
      const client = fakeClient(VALID_PAYLOAD);

      gateway.handleJoin(client as unknown as WebSocket, {
        roomId: 'wrong-room',
      });

      expect(client.close).toHaveBeenCalledWith(WsCloseCode.UNAUTHORIZED, 'Room ID mismatch');
    });

    it('GIVEN non-existent room WHEN joining THEN closes with ROOM_NOT_FOUND', () => {
      const { gateway } = createFixture();
      const client = fakeClient(VALID_PAYLOAD);

      gateway.handleJoin(client as unknown as WebSocket, {
        roomId: 'room-1',
      });

      expect(client.close).toHaveBeenCalledWith(WsCloseCode.ROOM_NOT_FOUND, 'Room not found');
    });

    it('GIVEN duplicate connection WHEN joining THEN closes with ALREADY_CONNECTED', () => {
      const { gateway, roomRegistry } = createFixture();
      roomRegistry.createRoom('room-1');
      roomRegistry.addClient(
        'room-1',
        'user-1',
        fakeClient(VALID_PAYLOAD) as unknown as AuthenticatedClient,
      );
      const client = fakeClient(VALID_PAYLOAD);

      gateway.handleJoin(client as unknown as WebSocket, {
        roomId: 'room-1',
      });

      expect(client.close).toHaveBeenCalledWith(WsCloseCode.ALREADY_CONNECTED, 'Already connected');
    });

    it('GIVEN unauthenticated client WHEN joining THEN closes with UNAUTHORIZED', () => {
      const { gateway } = createFixture();
      const client = fakeClient(); // no user

      gateway.handleJoin(client as unknown as WebSocket, {
        roomId: 'room-1',
      });

      expect(client.close).toHaveBeenCalledWith(WsCloseCode.UNAUTHORIZED, 'Unauthorized');
    });
  });

  describe('handleDisconnect', () => {
    it('GIVEN authenticated client in room WHEN disconnecting THEN removes and notifies', () => {
      const { gateway, roomRegistry, collaborationService } = createFixture();
      roomRegistry.createRoom('room-1');
      const client = fakeClient(VALID_PAYLOAD);
      roomRegistry.addClient('room-1', 'user-1', client as unknown as AuthenticatedClient);

      gateway.handleDisconnect(client as unknown as WebSocket);

      expect(roomRegistry.hasClient('room-1', 'user-1')).toBe(false);
      expect(collaborationService.notifyUserDisconnected).toHaveBeenCalledWith(
        expect.objectContaining({ roomId: 'room-1', userId: 'user-1' }),
      );
    });

    it('GIVEN unauthenticated client WHEN disconnecting THEN does nothing', () => {
      const { gateway, collaborationService } = createFixture();
      const client = fakeClient(); // no user

      gateway.handleDisconnect(client as unknown as WebSocket);

      expect(collaborationService.notifyUserDisconnected).not.toHaveBeenCalled();
    });

    it('GIVEN client in destroyed room WHEN disconnecting THEN does not notify', () => {
      const { gateway, collaborationService } = createFixture();
      const client = fakeClient(VALID_PAYLOAD);
      // Room doesn't exist, simulates room already destroyed

      gateway.handleDisconnect(client as unknown as WebSocket);

      expect(collaborationService.notifyUserDisconnected).not.toHaveBeenCalled();
    });
  });
});
