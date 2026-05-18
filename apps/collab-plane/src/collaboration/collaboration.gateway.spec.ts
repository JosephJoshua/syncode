import type { IncomingMessage } from 'node:http';
import { UnauthorizedException } from '@nestjs/common';
import type { IControlPlaneCallbackClient } from '@syncode/contracts';
import { WsMessageType } from '@syncode/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { WebSocket } from 'ws';
import type { CollabTokenPayload } from '../auth/collab-token-payload.js';
import type { AuthenticatedClient, WsAuthService } from '../auth/index.js';
import type { AwarenessHandler } from './awareness.handler.js';
import { CollaborationGateway } from './collaboration.gateway.js';
import type { CollaborationService } from './collaboration.service.js';
import { RoomRegistry } from './room-registry.js';
import { WsCloseCode } from './ws-close-codes.js';
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
    heartbeatParticipants: vi.fn(),
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

  const callbackClient = {
    notifyUserDisconnected: vi.fn(),
    notifySnapshotReady: vi.fn(),
    heartbeatParticipants: vi.fn(),
    authorizeJoin: vi.fn().mockResolvedValue({ authorized: true }),
  };

  const gateway = new CollaborationGateway(
    wsAuthService as unknown as WsAuthService,
    roomRegistry,
    collaborationService as unknown as CollaborationService,
    syncHandler as unknown as YjsSyncHandler,
    awarenessHandler as unknown as AwarenessHandler,
    callbackClient as unknown as IControlPlaneCallbackClient,
  );

  return {
    gateway,
    wsAuthService,
    roomRegistry,
    collaborationService,
    syncHandler,
    awarenessHandler,
    callbackClient,
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
    it('GIVEN valid join WHEN joining THEN adds client to room and sends room-state', async () => {
      const { gateway, roomRegistry } = createFixture();
      roomRegistry.createRoom('room-1');
      const client = fakeClient(VALID_PAYLOAD);

      await gateway.handleJoin(client as unknown as WebSocket, { roomId: 'room-1' });

      expect(roomRegistry.hasClient('room-1', 'user-1')).toBe(true);
      const sent = JSON.parse(client.send.mock.calls[0]![0] as string);
      expect(sent.type).toBe('room-state');
      expect(sent.data).toMatchObject({ phase: 'waiting', editorLocked: false });
      expect(sent.timestamp).toBeGreaterThan(0);
    });

    it('GIVEN mismatched roomId WHEN joining THEN closes with UNAUTHORIZED', async () => {
      const { gateway } = createFixture();
      const client = fakeClient(VALID_PAYLOAD);

      await gateway.handleJoin(client as unknown as WebSocket, { roomId: 'wrong-room' });

      expect(client.close).toHaveBeenCalledWith(WsCloseCode.UNAUTHORIZED, 'Room ID mismatch');
    });

    it('GIVEN non-existent room WHEN joining THEN closes with ROOM_NOT_FOUND', async () => {
      const { gateway } = createFixture();
      const client = fakeClient(VALID_PAYLOAD);

      await gateway.handleJoin(client as unknown as WebSocket, { roomId: 'room-1' });

      expect(client.close).toHaveBeenCalledWith(WsCloseCode.ROOM_NOT_FOUND, 'Room not found');
    });

    it('GIVEN duplicate connection WHEN joining THEN evicts stale connection and lets new one proceed', async () => {
      const { gateway, roomRegistry } = createFixture();
      roomRegistry.createRoom('room-1');
      const staleClient = fakeClient(VALID_PAYLOAD);
      roomRegistry.addClient('room-1', 'user-1', staleClient as unknown as AuthenticatedClient);
      const newClient = fakeClient(VALID_PAYLOAD);

      await gateway.handleJoin(newClient as unknown as WebSocket, { roomId: 'room-1' });

      // Stale connection is closed, new one is registered
      expect(staleClient.close).toHaveBeenCalledWith(
        WsCloseCode.ALREADY_CONNECTED,
        'Replaced by new connection',
      );
      expect(newClient.close).not.toHaveBeenCalled();
      expect(roomRegistry.hasClient('room-1', 'user-1')).toBe(true);
    });

    it('GIVEN unauthenticated client WHEN joining THEN closes with UNAUTHORIZED', async () => {
      const { gateway } = createFixture();
      const client = fakeClient();

      await gateway.handleJoin(client as unknown as WebSocket, { roomId: 'room-1' });

      expect(client.close).toHaveBeenCalledWith(WsCloseCode.UNAUTHORIZED, 'Unauthorized');
    });

    it('GIVEN invalid payload WHEN joining THEN closes with UNAUTHORIZED', async () => {
      const { gateway } = createFixture();
      const client = fakeClient(VALID_PAYLOAD);

      await gateway.handleJoin(client as unknown as WebSocket, null as never);

      expect(client.close).toHaveBeenCalledWith(WsCloseCode.UNAUTHORIZED, 'Invalid join payload');
    });

    it('GIVEN control-plane denies join WHEN joining THEN closes with FORBIDDEN and does not add client', async () => {
      const { gateway, roomRegistry, callbackClient } = createFixture();
      roomRegistry.createRoom('room-1');
      callbackClient.authorizeJoin.mockResolvedValueOnce({
        authorized: false,
        reason: 'participant-removed',
      });
      const client = fakeClient(VALID_PAYLOAD);

      await gateway.handleJoin(client as unknown as WebSocket, { roomId: 'room-1' });

      expect(callbackClient.authorizeJoin).toHaveBeenCalledWith('room-1', 'user-1');
      expect(client.close).toHaveBeenCalledWith(WsCloseCode.FORBIDDEN, 'participant-removed');
      expect(roomRegistry.hasClient('room-1', 'user-1')).toBe(false);
    });

    it('GIVEN control-plane denies without reason WHEN joining THEN closes with FORBIDDEN and fallback message', async () => {
      const { gateway, roomRegistry, callbackClient } = createFixture();
      roomRegistry.createRoom('room-1');
      callbackClient.authorizeJoin.mockResolvedValueOnce({ authorized: false });
      const client = fakeClient(VALID_PAYLOAD);

      await gateway.handleJoin(client as unknown as WebSocket, { roomId: 'room-1' });

      expect(client.close).toHaveBeenCalledWith(WsCloseCode.FORBIDDEN, 'Join denied');
      expect(roomRegistry.hasClient('room-1', 'user-1')).toBe(false);
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

  describe('heartbeat', () => {
    it('GIVEN connected client WHEN heartbeat fires THEN sends ping and marks as not alive', async () => {
      const { gateway, wsAuthService } = createFixture();
      wsAuthService.authenticate.mockResolvedValueOnce(VALID_PAYLOAD);
      const client = fakeClient(VALID_PAYLOAD) as unknown as WebSocket & {
        isAlive?: boolean;
        readyState: number;
        OPEN: number;
        ping: ReturnType<typeof vi.fn>;
        terminate: ReturnType<typeof vi.fn>;
      };
      client.readyState = 1;
      client.OPEN = 1;
      client.ping = vi.fn();
      client.terminate = vi.fn();

      await gateway.handleConnection(client as unknown as WebSocket, {} as IncomingMessage);

      // Simulate heartbeat
      (gateway as unknown as { heartbeat(): void }).heartbeat();

      expect(client.ping).toHaveBeenCalledOnce();
      expect(client.isAlive).toBe(false);
    });

    it('GIVEN unresponsive client WHEN heartbeat fires twice THEN terminates the client', async () => {
      const { gateway, wsAuthService } = createFixture();
      wsAuthService.authenticate.mockResolvedValueOnce(VALID_PAYLOAD);
      const client = fakeClient(VALID_PAYLOAD) as unknown as WebSocket & {
        isAlive?: boolean;
        readyState: number;
        OPEN: number;
        ping: ReturnType<typeof vi.fn>;
        terminate: ReturnType<typeof vi.fn>;
      };
      client.readyState = 1;
      client.OPEN = 1;
      client.ping = vi.fn();
      client.terminate = vi.fn();

      await gateway.handleConnection(client as unknown as WebSocket, {} as IncomingMessage);

      // First heartbeat: marks as not alive, sends ping
      (gateway as unknown as { heartbeat(): void }).heartbeat();
      expect(client.isAlive).toBe(false);

      // No pong received — second heartbeat terminates
      (gateway as unknown as { heartbeat(): void }).heartbeat();
      expect(client.terminate).toHaveBeenCalledOnce();
    });

    it('GIVEN client with pong WHEN heartbeat fires twice THEN client stays alive', async () => {
      const { gateway, wsAuthService } = createFixture();
      wsAuthService.authenticate.mockResolvedValueOnce(VALID_PAYLOAD);
      const listeners = new Map<string, (...args: unknown[]) => void>();
      const client = {
        close: vi.fn(),
        send: vi.fn(),
        on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
          listeners.set(event, cb);
        }),
        readyState: 1,
        OPEN: 1,
        ping: vi.fn(),
        terminate: vi.fn(),
        isAlive: true,
      };

      await gateway.handleConnection(client as unknown as WebSocket, {} as IncomingMessage);

      // First heartbeat
      (gateway as unknown as { heartbeat(): void }).heartbeat();
      expect(client.isAlive).toBe(false);

      // Simulate pong
      listeners.get('pong')?.();
      expect(client.isAlive).toBe(true);

      // Second heartbeat — should ping again, NOT terminate
      (gateway as unknown as { heartbeat(): void }).heartbeat();
      expect(client.terminate).not.toHaveBeenCalled();
      expect(client.ping).toHaveBeenCalledTimes(2);
    });

    it('GIVEN closed client WHEN heartbeat fires THEN removes from tracking set', async () => {
      const { gateway, wsAuthService } = createFixture();
      wsAuthService.authenticate.mockResolvedValueOnce(VALID_PAYLOAD);
      const client = fakeClient(VALID_PAYLOAD) as unknown as WebSocket & {
        readyState: number;
        OPEN: number;
        ping: ReturnType<typeof vi.fn>;
        terminate: ReturnType<typeof vi.fn>;
      };
      client.readyState = 3; // CLOSED
      client.OPEN = 1;
      client.ping = vi.fn();
      client.terminate = vi.fn();

      await gateway.handleConnection(client as unknown as WebSocket, {} as IncomingMessage);

      (gateway as unknown as { heartbeat(): void }).heartbeat();

      // Should not ping or terminate — just remove
      expect(client.ping).not.toHaveBeenCalled();
      expect(client.terminate).not.toHaveBeenCalled();
    });
  });

  describe('handleChatSend', () => {
    function setupRoomWithClient() {
      const fixture = createFixture();
      fixture.roomRegistry.createRoom('room-1');
      const client = fakeClient(VALID_PAYLOAD);
      fixture.roomRegistry.addClient('room-1', 'user-1', client as unknown as AuthenticatedClient);
      return { ...fixture, client };
    }

    it('GIVEN attachment with javascript: url WHEN sending THEN drops the attachment', () => {
      const { gateway, roomRegistry, client } = setupRoomWithClient();

      gateway.handleChatSend(client as unknown as WebSocket, {
        text: 'check this out',
        attachments: [
          {
            kind: 'image',
            key: 'rooms/room-1/chat/evil',
            url: 'javascript:alert(1)',
            fileName: 'x.png',
            mimeType: 'image/png',
            sizeBytes: 1,
          },
        ],
      });

      const messages = roomRegistry.getRoom('room-1')?.chatMessages ?? [];
      expect(messages).toHaveLength(1);
      expect(messages[0]!.attachments).toEqual([]);
    });

    it('GIVEN attachment with https url WHEN sending THEN keeps the attachment', () => {
      const { gateway, roomRegistry, client } = setupRoomWithClient();

      gateway.handleChatSend(client as unknown as WebSocket, {
        text: '',
        attachments: [
          {
            kind: 'image',
            key: 'rooms/room-1/chat/ok',
            url: 'https://cdn.example.com/rooms/room-1/chat/ok.png',
            fileName: 'ok.png',
            mimeType: 'image/png',
            sizeBytes: 100,
          },
        ],
      });

      const messages = roomRegistry.getRoom('room-1')?.chatMessages ?? [];
      expect(messages).toHaveLength(1);
      expect(messages[0]!.attachments).toHaveLength(1);
    });

    it('GIVEN text longer than the cap WHEN sending THEN truncates to the cap', () => {
      const { gateway, roomRegistry, client } = setupRoomWithClient();
      const oversized = 'a'.repeat(5000);

      gateway.handleChatSend(client as unknown as WebSocket, { text: oversized });

      const messages = roomRegistry.getRoom('room-1')?.chatMessages ?? [];
      expect(messages).toHaveLength(1);
      expect(messages[0]!.text.length).toBe(4000);
    });
  });

  describe('handleChatReactToggle', () => {
    function setupRoomWithMessage() {
      const fixture = createFixture();
      fixture.roomRegistry.createRoom('room-1');
      const client = fakeClient(VALID_PAYLOAD);
      fixture.roomRegistry.addClient('room-1', 'user-1', client as unknown as AuthenticatedClient);
      const message = fixture.roomRegistry.createChatMessage('room-1', {
        userId: 'user-1',
        text: 'hi',
        replyToMessageId: null,
        mentions: [],
        attachments: [],
      });
      return { ...fixture, client, message };
    }

    it('GIVEN emoji outside the palette WHEN toggling THEN ignores the request', () => {
      const { gateway, roomRegistry, client, message } = setupRoomWithMessage();

      gateway.handleChatReactToggle(client as unknown as WebSocket, {
        messageId: message.messageId,
        emoji: '🤡',
      });

      const stored = roomRegistry.getRoom('room-1')?.chatMessages[0];
      expect(stored?.reactions).toEqual([]);
    });

    it('GIVEN emoji from the palette WHEN toggling THEN records the reaction', () => {
      const { gateway, roomRegistry, client, message } = setupRoomWithMessage();

      gateway.handleChatReactToggle(client as unknown as WebSocket, {
        messageId: message.messageId,
        emoji: '👍',
      });

      const stored = roomRegistry.getRoom('room-1')?.chatMessages[0];
      expect(stored?.reactions).toEqual([{ emoji: '👍', userIds: ['user-1'] }]);
    });
  });
});
