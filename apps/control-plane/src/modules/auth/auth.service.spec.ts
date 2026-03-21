import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { refreshTokens, users } from '@syncode/db';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';

const scryptAsync = promisify(scrypt);

async function createPasswordHash(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

function createAuthServiceFixture() {
  const findFirst = vi.fn();
  const usersReturning = vi.fn();
  const usersValues = vi.fn(() => ({ returning: usersReturning }));
  const refreshValues = vi.fn(async () => undefined);

  const insert = vi.fn((table: unknown) => {
    if (table === users) {
      return {
        values: usersValues,
      };
    }

    if (table === refreshTokens) {
      return {
        values: refreshValues,
      };
    }

    throw new Error('Unexpected table in mock db.insert');
  });

  const db = {
    query: {
      users: {
        findFirst,
      },
    },
    insert,
  };

  const cacheService = {
    get: vi.fn(async () => null),
    set: vi.fn(async () => undefined),
    del: vi.fn(async () => undefined),
    delByPattern: vi.fn(async () => 0),
    exists: vi.fn(async (key: string) => !key.includes('auth:refresh:revoked:')),
    getTtl: vi.fn(async () => ({ state: 'missing' as const })),
    incrBy: vi.fn(async () => 0),
    setIfNotExists: vi.fn(async () => false),
    expire: vi.fn(async () => false),
    shutdown: vi.fn(async () => undefined),
  };

  const jwtService = {
    signAsync: vi.fn(async (payload: { tokenType?: 'access' | 'refresh' }) =>
      payload.tokenType === 'refresh' ? 'refresh-token' : 'access-token',
    ),
    verifyAsync: vi.fn(async () => ({
      sub: 'user-1',
      email: 'user@example.com',
      tokenType: 'refresh' as const,
      jti: 'jti-1',
      iat: Math.floor(Date.now() / 1000) - 10,
      exp: Math.floor(Date.now() / 1000) + 3600,
    })),
    decode: vi.fn(() => ({ exp: Math.floor(Date.now() / 1000) + 3600 })),
  };

  const configService = {
    get: vi.fn((key: string) => {
      if (key === 'JWT_REFRESH_SECRET') return 'r'.repeat(32);
      if (key === 'JWT_REFRESH_EXPIRATION') return '7d';
      return undefined;
    }),
  };

  const service = new AuthService(
    db as never,
    cacheService as never,
    jwtService as never,
    configService as never,
  );

  return {
    service,
    mocks: {
      findFirst,
      usersReturning,
      usersValues,
      refreshValues,
      cacheService,
      jwtService,
    },
  };
}

describe('AuthService', () => {
  it('GIVEN available username/email WHEN registering THEN returns auth payload with user profile', async () => {
    const { service, mocks } = createAuthServiceFixture();

    mocks.findFirst.mockResolvedValueOnce(null);
    mocks.usersReturning.mockResolvedValueOnce([
      {
        id: '497f6eca-6276-4993-bfeb-53cbbbba6f08',
        email: 'alice@example.com',
        username: 'alice',
        displayName: null,
        role: 'user',
        avatarUrl: null,
        bio: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);

    const result = await service.register('alice', 'Alice@Example.com', 'secret123');

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(result.user.email).toBe('alice@example.com');
    expect(result.user.username).toBe('alice');

    const firstInsertCall = mocks.usersValues.mock.calls.at(0);
    expect(firstInsertCall).toBeDefined();
    if (!firstInsertCall) {
      throw new Error('Expected users insert to be called at least once');
    }

    const insertedValue = firstInsertCall.at(0);
    expect(insertedValue).toBeDefined();
    if (!insertedValue || typeof insertedValue !== 'object') {
      throw new Error('Expected inserted user values object');
    }

    const insertedUserValues = insertedValue as {
      email: string;
      passwordHash: string;
    };
    expect(insertedUserValues.email).toBe('alice@example.com');
    expect(insertedUserValues.passwordHash).not.toBe('secret123');
  });

  it('GIVEN existing username/email WHEN registering THEN throws conflict', async () => {
    const { service, mocks } = createAuthServiceFixture();
    mocks.findFirst.mockResolvedValueOnce({ id: 'existing' });

    await expect(
      service.register('alice', 'alice@example.com', 'secret123'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('GIVEN unique constraint race WHEN registering THEN throws conflict', async () => {
    const { service, mocks } = createAuthServiceFixture();
    mocks.findFirst.mockResolvedValueOnce(null);
    mocks.usersReturning.mockRejectedValueOnce({ code: '23505' });

    await expect(
      service.register('alice', 'alice@example.com', 'secret123'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('GIVEN missing user WHEN logging in THEN throws unauthorized', async () => {
    const { service, mocks } = createAuthServiceFixture();
    mocks.findFirst.mockResolvedValueOnce(null);

    await expect(service.login('alice', 'secret123')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('GIVEN banned user WHEN logging in THEN throws forbidden', async () => {
    const { service, mocks } = createAuthServiceFixture();
    const passwordHash = await createPasswordHash('secret123');

    mocks.findFirst.mockResolvedValueOnce({
      id: '497f6eca-6276-4993-bfeb-53cbbbba6f08',
      email: 'alice@example.com',
      username: 'alice',
      displayName: null,
      role: 'user',
      avatarUrl: null,
      bio: null,
      passwordHash,
      bannedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(service.login('alice', 'secret123')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('GIVEN valid credentials WHEN logging in THEN returns access/refresh and user profile', async () => {
    const { service, mocks } = createAuthServiceFixture();
    const passwordHash = await createPasswordHash('secret123');

    mocks.findFirst.mockResolvedValueOnce({
      id: '497f6eca-6276-4993-bfeb-53cbbbba6f08',
      email: 'alice@example.com',
      username: 'alice',
      displayName: null,
      role: 'user',
      avatarUrl: null,
      bio: null,
      passwordHash,
      bannedAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await service.login('alice', 'secret123');

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(result.user.username).toBe('alice');
    expect(mocks.refreshValues).toHaveBeenCalled();
  });

  it('GIVEN invalid refresh token WHEN refreshing THEN throws unauthorized', async () => {
    const { service, mocks } = createAuthServiceFixture();
    mocks.jwtService.verifyAsync.mockRejectedValueOnce(new Error('invalid'));

    await expect(service.refreshToken('bad-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('GIVEN valid refresh token WHEN refreshing THEN rotates and returns token pair', async () => {
    const { service, mocks } = createAuthServiceFixture();
    mocks.findFirst.mockResolvedValueOnce({
      id: 'user-1',
      email: 'user@example.com',
      bannedAt: null,
    });

    const result = await service.refreshToken('refresh-token');

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(mocks.cacheService.del).toHaveBeenCalledWith('auth:refresh:active:user-1:jti-1');
  });

  it('GIVEN banned user WHEN refreshing THEN revokes all and throws unauthorized', async () => {
    const { service, mocks } = createAuthServiceFixture();
    const revokeAllSpy = vi.spyOn(service, 'revokeAllRefreshTokensForUser');

    mocks.findFirst.mockResolvedValueOnce({
      id: 'user-1',
      email: 'user@example.com',
      bannedAt: new Date(),
    });

    await expect(service.refreshToken('refresh-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(revokeAllSpy).toHaveBeenCalledWith('user-1');
  });

  it('GIVEN valid refresh token WHEN logging out THEN revokes active refresh token', async () => {
    const { service, mocks } = createAuthServiceFixture();

    await service.logout('refresh-token');

    expect(mocks.cacheService.set).toHaveBeenCalled();
    expect(mocks.cacheService.del).toHaveBeenCalledWith('auth:refresh:active:user-1:jti-1');
  });
});
