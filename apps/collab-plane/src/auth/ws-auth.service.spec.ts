import type { IncomingMessage } from 'node:http';
import { UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import { describe, expect, it, vi } from 'vitest';
import type { CollabTokenPayload } from './collab-token-payload.js';
import { WsAuthService } from './ws-auth.service.js';

const VALID_PAYLOAD: CollabTokenPayload = {
  sub: 'user-1',
  roomId: 'room-1',
  role: 'candidate',
  type: 'collab',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 86400,
};

function createFixture() {
  const jwtService = {
    verifyAsync: vi.fn<(token: string) => Promise<CollabTokenPayload>>(),
  };

  const service = new WsAuthService(jwtService as unknown as JwtService);

  return { service, jwtService };
}

function fakeRequest(options: { url?: string; authorization?: string } = {}): IncomingMessage {
  return {
    url: options.url ?? '/',
    headers: {
      host: 'localhost:3001',
      ...(options.authorization ? { authorization: options.authorization } : {}),
    },
  } as unknown as IncomingMessage;
}

describe('WsAuthService', () => {
  it('GIVEN valid token in query param WHEN authenticating THEN returns payload', async () => {
    const { service, jwtService } = createFixture();
    jwtService.verifyAsync.mockResolvedValueOnce(VALID_PAYLOAD);

    const result = await service.authenticate(fakeRequest({ url: '/?token=valid-jwt' }));

    expect(result).toEqual(VALID_PAYLOAD);
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-jwt');
  });

  it('GIVEN valid token in Authorization header WHEN authenticating THEN returns payload', async () => {
    const { service, jwtService } = createFixture();
    jwtService.verifyAsync.mockResolvedValueOnce(VALID_PAYLOAD);

    const result = await service.authenticate(fakeRequest({ authorization: 'Bearer header-jwt' }));

    expect(result).toEqual(VALID_PAYLOAD);
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('header-jwt');
  });

  it('GIVEN token in both query param and header WHEN authenticating THEN prefers query param', async () => {
    const { service, jwtService } = createFixture();
    jwtService.verifyAsync.mockResolvedValueOnce(VALID_PAYLOAD);

    await service.authenticate(
      fakeRequest({ url: '/?token=query-jwt', authorization: 'Bearer header-jwt' }),
    );

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('query-jwt');
  });

  it('GIVEN no token WHEN authenticating THEN throws UnauthorizedException', async () => {
    const { service } = createFixture();

    await expect(service.authenticate(fakeRequest())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('GIVEN expired or invalid token WHEN authenticating THEN throws UnauthorizedException', async () => {
    const { service, jwtService } = createFixture();
    jwtService.verifyAsync.mockRejectedValueOnce(new Error('jwt expired'));

    await expect(
      service.authenticate(fakeRequest({ url: '/?token=expired-jwt' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('GIVEN non-collab token type WHEN authenticating THEN throws UnauthorizedException', async () => {
    const { service, jwtService } = createFixture();
    jwtService.verifyAsync.mockResolvedValueOnce({ ...VALID_PAYLOAD, type: 'access' });

    await expect(
      service.authenticate(fakeRequest({ url: '/?token=auth-jwt' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
