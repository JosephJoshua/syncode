import type { IncomingMessage } from 'node:http';
import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { WebSocket } from 'ws';
import type { CollabTokenPayload } from '../auth/collab-token-payload.js';
import type { AuthenticatedClient, WsAuthService } from '../auth/index.js';
import type { AwarenessHandler } from './awareness.handler.js';
import { CollaborationGateway } from './collaboration.gateway.js';
import type { CollaborationService } from './collaboration.service.js';
import { RoomRegistry } from './room-registry.js';
import { WsCloseCode } from './ws-close-codes.js';
import { WsMessageType } from './ws-message-types.js';
import type { YjsSyncHandler } from './yjs-sync.handler.js';

const VALID_PAYLOAD: CollabTokenPayload = {
  sub: 'user-1',
  roomId: 'room-1',
  role: 'candidate',
  type: 'collab',
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
    checkRoomEmpty: vi.fn(),
    cancelRoomCleanup: vi.fn(),
  };

  const syncHandler = {
    handleSyncMessage: vi.fn(),
    sendInitialSync: vi.fn(),
  };

  const awarenessHandler = {
    handleAwarenessMessage: vi.fn(),
    sendFullAwareness: vi.fn(),
    removeClient: vi.fn(),
  };

  const gateway = new CollaborationGateway(
    wsAuthService as unknown as WsAuthService,
    roomRegistry,
    collaborationService as unknown as CollaborationService,
    syncHandler as unknown as YjsSyncHandler,
    awarenessHandler as unknown as AwarenessHandler,
  );

  return {
    gateway,
    wsAuthService,
    roomRegistry,
    collaborationService,
    syncHandler,
    awarenessHandler,
  };
}

function fakeClient(user?: CollabTokenPayload): WebSocket & { user?: CollabTokenPayload } {
  const listeners = new Map<string, (...args: unknown[]) => void>();
  const client = {
    close: vi.fn(),
    send: vi.fn(),
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      listeners.set(event, cb);
    }),
    /** Simulate a ws 'message' event for testing binary routing */
    _emit: (event: string, ...args: unknown[]) => {
      listeners.get(event)?.(...args);
    },
    user,
  };
  return client as unknown as WebSocket & {
    user?: CollabTokenPayload;
    _emit: (event: string, ...args: unknown[]) => void;
  };
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

  describe('binary message routing', () => {
    it('GIVEN joined client WHEN binary sync message arrives THEN routes to syncHandler', async () => {
      const { gateway, wsAuthService, roomRegistry, syncHandler } = createFixture();
      wsAuthService.authenticate.mockResolvedValueOnce(VALID_PAYLOAD);
      const client = fakeClient() as ReturnType<typeof fakeClient> & {
        _emit: (event: string, ...args: unknown[]) => void;
      };

      await gateway.handleConnection(client as unknown as WebSocket, {} as IncomingMessage);

      // Client must be registered in the room for binary messages to be processed
      roomRegistry.createRoom('room-1');
      roomRegistry.addClient('room-1', 'user-1', client as unknown as AuthenticatedClient);

      const syncMessage = Buffer.from([WsMessageType.SYNC, 0, 1, 2]);
      client._emit('message', syncMessage, true);

      expect(syncHandler.handleSyncMessage).toHaveBeenCalledWith(
        'room-1',
        'user-1',
        expect.any(Uint8Array),
      );
    });

    it('GIVEN joined client WHEN binary awareness message arrives THEN routes to awarenessHandler', async () => {
      const { gateway, wsAuthService, roomRegistry, awarenessHandler } = createFixture();
      wsAuthService.authenticate.mockResolvedValueOnce(VALID_PAYLOAD);
      const client = fakeClient() as ReturnType<typeof fakeClient> & {
        _emit: (event: string, ...args: unknown[]) => void;
      };

      await gateway.handleConnection(client as unknown as WebSocket, {} as IncomingMessage);

      roomRegistry.createRoom('room-1');
      roomRegistry.addClient('room-1', 'user-1', client as unknown as AuthenticatedClient);

      const awarenessMessage = Buffer.from([WsMessageType.AWARENESS, 0, 1, 2]);
      client._emit('message', awarenessMessage, true);

      expect(awarenessHandler.handleAwarenessMessage).toHaveBeenCalledWith(
        'room-1',
        'user-1',
        expect.any(Uint8Array),
      );
    });

    it('GIVEN connected but not joined client WHEN binary message arrives THEN is ignored', async () => {
      const { gateway, wsAuthService, syncHandler, awarenessHandler } = createFixture();
      wsAuthService.authenticate.mockResolvedValueOnce(VALID_PAYLOAD);
      const client = fakeClient() as ReturnType<typeof fakeClient> & {
        _emit: (event: string, ...args: unknown[]) => void;
      };

      await gateway.handleConnection(client as unknown as WebSocket, {} as IncomingMessage);

      // Client authenticated but never joined — not in room registry
      client._emit('message', Buffer.from([WsMessageType.SYNC, 0, 1, 2]), true);

      expect(syncHandler.handleSyncMessage).not.toHaveBeenCalled();
      expect(awarenessHandler.handleAwarenessMessage).not.toHaveBeenCalled();
    });

    it('GIVEN connected client WHEN text message arrives THEN binary listener ignores it', async () => {
      const { gateway, wsAuthService, syncHandler, awarenessHandler } = createFixture();
      wsAuthService.authenticate.mockResolvedValueOnce(VALID_PAYLOAD);
      const client = fakeClient() as ReturnType<typeof fakeClient> & {
        _emit: (event: string, ...args: unknown[]) => void;
      };

      await gateway.handleConnection(client as unknown as WebSocket, {} as IncomingMessage);

      // Simulate a text (non-binary) message
      client._emit('message', Buffer.from('{"type":"join"}'), false);

      expect(syncHandler.handleSyncMessage).not.toHaveBeenCalled();
      expect(awarenessHandler.handleAwarenessMessage).not.toHaveBeenCalled();
    });
  });

  describe('handleJoin', () => {
    it('GIVEN valid join WHEN joining THEN adds client to room and sends room-state', () => {
      const { gateway, roomRegistry } = createFixture();
      roomRegistry.createRoom('room-1');
      const client = fakeClient(VALID_PAYLOAD);

      gateway.handleJoin(client as unknown as WebSocket, { roomId: 'room-1' });

      expect(roomRegistry.hasClient('room-1', 'user-1')).toBe(true);
      const sent = JSON.parse(client.send.mock.calls[0]![0] as string);
      expect(sent.type).toBe('room-state');
      expect(sent.data).toMatchObject({ phase: 'waiting', editorLocked: false });
      expect(sent.timestamp).toBeGreaterThan(0);
    });

    it('GIVEN mismatched roomId WHEN joining THEN closes with UNAUTHORIZED', () => {
      const { gateway } = createFixture();
      const client = fakeClient(VALID_PAYLOAD);

      gateway.handleJoin(client as unknown as WebSocket, { roomId: 'wrong-room' });

      expect(client.close).toHaveBeenCalledWith(WsCloseCode.UNAUTHORIZED, 'Room ID mismatch');
    });

    it('GIVEN non-existent room WHEN joining THEN closes with ROOM_NOT_FOUND', () => {
      const { gateway } = createFixture();
      const client = fakeClient(VALID_PAYLOAD);

      gateway.handleJoin(client as unknown as WebSocket, { roomId: 'room-1' });

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

      gateway.handleJoin(client as unknown as WebSocket, { roomId: 'room-1' });

      expect(client.close).toHaveBeenCalledWith(WsCloseCode.ALREADY_CONNECTED, 'Already connected');
    });

    it('GIVEN unauthenticated client WHEN joining THEN closes with UNAUTHORIZED', () => {
      const { gateway } = createFixture();
      const client = fakeClient();

      gateway.handleJoin(client as unknown as WebSocket, { roomId: 'room-1' });

      expect(client.close).toHaveBeenCalledWith(WsCloseCode.UNAUTHORIZED, 'Unauthorized');
    });

    it('GIVEN invalid payload WHEN joining THEN closes with UNAUTHORIZED', () => {
      const { gateway } = createFixture();
      const client = fakeClient(VALID_PAYLOAD);

      gateway.handleJoin(client as unknown as WebSocket, null as never);

      expect(client.close).toHaveBeenCalledWith(WsCloseCode.UNAUTHORIZED, 'Invalid join payload');
    });
  });

  describe('handleDisconnect', () => {
    it('GIVEN authenticated client in room WHEN disconnecting THEN removes from room', () => {
      const { gateway, roomRegistry } = createFixture();
      roomRegistry.createRoom('room-1');
      const client = fakeClient(VALID_PAYLOAD);
      roomRegistry.addClient('room-1', 'user-1', client as unknown as AuthenticatedClient);

      gateway.handleDisconnect(client as unknown as WebSocket);

      expect(roomRegistry.hasClient('room-1', 'user-1')).toBe(false);
    });

    it('GIVEN unauthenticated client WHEN disconnecting THEN does nothing', () => {
      const { gateway, roomRegistry } = createFixture();
      roomRegistry.createRoom('room-1');
      const client = fakeClient();

      gateway.handleDisconnect(client as unknown as WebSocket);

      // Room should be unaffected
      expect(roomRegistry.hasRoom('room-1')).toBe(true);
    });

    it('GIVEN client in destroyed room WHEN disconnecting THEN does not throw', () => {
      const { gateway } = createFixture();
      const client = fakeClient(VALID_PAYLOAD);

      expect(() => gateway.handleDisconnect(client as unknown as WebSocket)).not.toThrow();
    });
  });
});
