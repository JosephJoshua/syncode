import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { ERROR_CODES } from '@syncode/contracts';
import type { Database } from '@syncode/db';
import { refreshTokens, users } from '@syncode/db';
import type { ICacheService } from '@syncode/shared/ports';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';

const scryptAsync = promisify(scrypt);

type AuthServiceDatabaseMock = {
  query: {
    users: {
      findFirst: (...args: unknown[]) => Promise<unknown>;
    };
  };
  insert: (table: unknown) => {
    values: (...args: unknown[]) => unknown;
  };
  delete: (table: unknown) => {
    where: (...args: unknown[]) => unknown;
  };
  update: (table: unknown) => {
    set: (...args: unknown[]) => {
      where: (...args: unknown[]) => unknown;
    };
  };
};

type AuthServiceJwtServiceMock = {
  signAsync: (payload: { tokenType?: 'access' | 'refresh' }) => Promise<string>;
  verifyAsync: (token: string, options?: unknown) => Promise<unknown>;
  decode: (token: string) => unknown;
};

type AuthServiceConfigServiceMock = {
  get: (key: string, options?: unknown) => string | undefined;
};

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
  const deleteWhere = vi.fn(async () => undefined);
  const updateWhere = vi.fn(async () => undefined);
  const updateSet = vi.fn(() => ({ where: updateWhere }));

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
    update: vi.fn((table: unknown) => {
      if (table === refreshTokens) {
        return {
          set: updateSet,
        };
      }

      throw new Error('Unexpected table in mock db.update');
    }),
    delete: vi.fn((table: unknown) => {
      if (table === refreshTokens) {
        return {
          where: deleteWhere,
        };
      }

      throw new Error('Unexpected table in mock db.delete');
    }),
  } satisfies AuthServiceDatabaseMock;

  const cacheService: Partial<ICacheService> = {
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
  } satisfies AuthServiceJwtServiceMock;

  const configService = {
    get: vi.fn((key: string) => {
      if (key === 'JWT_REFRESH_SECRET') return 'r'.repeat(32);
      if (key === 'JWT_REFRESH_EXPIRATION') return '7d';
      return undefined;
    }),
  } satisfies AuthServiceConfigServiceMock;

  const service = new AuthService(
    db as unknown as Database,
    cacheService as ICacheService,
    jwtService as unknown as JwtService,
    configService as unknown as ConfigService,
  );

  return {
    service,
    mocks: {
      findFirst,
      usersReturning,
      usersValues,
      refreshValues,
      deleteWhere,
      updateSet,
      updateWhere,
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

  it('GIVEN missing user WHEN logging in THEN throws unauthorized with AUTH_INVALID_CREDENTIALS code', async () => {
    const { service, mocks } = createAuthServiceFixture();
    mocks.findFirst.mockResolvedValueOnce(null);

    await expect(service.login('alice', 'secret123')).rejects.toMatchObject({
      response: {
        message: 'Invalid credentials',
        code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
      },
    } satisfies Partial<UnauthorizedException>);
  });

  it('GIVEN banned user WHEN logging in THEN throws unauthorized with USER_BANNED code', async () => {
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

    await expect(service.login('alice', 'secret123')).rejects.toBeInstanceOf(UnauthorizedException);
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
  });

  it('GIVEN banned user WHEN refreshing THEN throws unauthorized', async () => {
    const { service, mocks } = createAuthServiceFixture();

    mocks.findFirst.mockResolvedValueOnce({
      id: 'user-1',
      email: 'user@example.com',
      bannedAt: new Date(),
    });

    await expect(service.refreshToken('refresh-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('GIVEN valid refresh token WHEN logging out THEN completes without error', async () => {
    const { service } = createAuthServiceFixture();

    await expect(service.logout('refresh-token')).resolves.toBeUndefined();
  });

  it('GIVEN expired refresh tokens WHEN cleanup runs THEN completes without error', async () => {
    const { service } = createAuthServiceFixture();

    await expect(service.cleanupExpiredRefreshTokens()).resolves.toBeUndefined();
  });

  it('GIVEN user id WHEN revoking all refresh tokens THEN completes without error', async () => {
    const { service } = createAuthServiceFixture();

    await expect(service.revokeAllRefreshTokensForUser('user-1')).resolves.toBeUndefined();
  });
});
