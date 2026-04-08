import type { IncomingMessage } from 'node:http';
import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { WebSocket } from 'ws';
import type { CollabTokenPayload } from '../auth/collab-token-payload.js';
import type { AuthenticatedClient, WsAuthService } from '../auth/index.js';
import { CollaborationGateway } from './collaboration.gateway.js';

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

  const gateway = new CollaborationGateway(wsAuthService as unknown as WsAuthService);

  const client = {
    close: vi.fn(),
  } as unknown as WebSocket;

  const request = {} as IncomingMessage;

  return { gateway, wsAuthService, client, request };
}

describe('CollaborationGateway', () => {
  describe('handleConnection', () => {
    it('GIVEN valid token WHEN connecting THEN attaches user to client', async () => {
      const { gateway, wsAuthService, client, request } = createFixture();
      wsAuthService.authenticate.mockResolvedValueOnce(VALID_PAYLOAD);

      await gateway.handleConnection(client, request);

      expect((client as AuthenticatedClient).user).toEqual(VALID_PAYLOAD);
      expect(client.close).not.toHaveBeenCalled();
    });

    it('GIVEN invalid token WHEN connecting THEN closes with 4001', async () => {
      const { gateway, wsAuthService, client, request } = createFixture();
      wsAuthService.authenticate.mockRejectedValueOnce(
        new UnauthorizedException('Invalid or expired token'),
      );

      await gateway.handleConnection(client, request);

      expect(client.close).toHaveBeenCalledWith(4001, 'Unauthorized');
      expect((client as AuthenticatedClient).user).toBeUndefined();
    });
  });
});
