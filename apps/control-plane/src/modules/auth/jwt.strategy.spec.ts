import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Database } from '@syncode/db';
import { describe, expect, it, vi } from 'vitest';
import { JwtStrategy } from './jwt.strategy';

type JwtStrategyDatabaseMock = {
  query: {
    users: {
      findFirst: (...args: unknown[]) => Promise<unknown>;
    };
  };
};

type JwtStrategyConfigServiceMock = {
  get: (key: string, options?: unknown) => string | undefined;
};

function createStrategyFixture() {
  const db = {
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
  } satisfies JwtStrategyDatabaseMock;

  const config = {
    get: vi.fn(() => 'x'.repeat(32)),
  } satisfies JwtStrategyConfigServiceMock;

  const strategy = new JwtStrategy(config as unknown as ConfigService, db as unknown as Database);

  return {
    strategy,
    db,
  };
}

describe('JwtStrategy', () => {
  it('GIVEN refresh token payload WHEN validating THEN throws unauthorized', async () => {
    const { strategy } = createStrategyFixture();

    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'user@example.com',
        iat: 1,
        exp: 2,
        tokenType: 'refresh',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('GIVEN missing user WHEN validating THEN throws unauthorized', async () => {
    const { strategy, db } = createStrategyFixture();
    db.query.users.findFirst.mockResolvedValueOnce(null);

    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'user@example.com',
        iat: 1,
        exp: 2,
        tokenType: 'access',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('GIVEN active user WHEN validating THEN returns request user object', async () => {
    const { strategy, db } = createStrategyFixture();
    db.query.users.findFirst.mockResolvedValueOnce({
      id: 'user-1',
      email: 'user@example.com',
      bannedAt: null,
    });

    const result = await strategy.validate({
      sub: 'user-1',
      email: 'user@example.com',
      iat: 1,
      exp: 2,
      tokenType: 'access',
    });

    expect(result).toEqual({
      id: 'user-1',
      email: 'user@example.com',
    });
  });
});
