import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Database } from '@syncode/db';
import { describe, expect, it, vi } from 'vitest';
import type { EnvConfig } from '@/config/env.config';
import { JwtStrategy } from './jwt.strategy';

type JwtStrategyDatabaseMock = {
  query: {
    users: Pick<Database['query']['users'], 'findFirst'>;
  };
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
  } satisfies Pick<ConfigService<EnvConfig>, 'get'>;

  const strategy = new JwtStrategy(config as ConfigService<EnvConfig>, db as Database);

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
