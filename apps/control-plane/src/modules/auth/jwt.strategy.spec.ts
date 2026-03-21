import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { JwtStrategy } from './jwt.strategy';

function createStrategyFixture() {
  const db = {
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
  };

  const config = {
    get: vi.fn(() => 'x'.repeat(32)),
  };

  const strategy = new JwtStrategy(config as never, db as never);

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
