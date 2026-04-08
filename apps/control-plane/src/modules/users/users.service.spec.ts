import { ConflictException, NotFoundException } from '@nestjs/common';
import { ERROR_CODES } from '@syncode/contracts';
import type { Database } from '@syncode/db';
import { describe, expect, it, vi } from 'vitest';
import type { AuthService } from '../auth/auth.service.js';
import { UsersService } from './users.service.js';

type UsersServiceDatabaseMock = {
  query: {
    users: {
      findFirst: (...args: unknown[]) => Promise<unknown>;
    };
    globalLimits: {
      findMany: (...args: unknown[]) => Promise<Array<{ key: string; value: number }>>;
    };
  };
  update: (...args: unknown[]) => {
    set: (...args: unknown[]) => {
      where: (...args: unknown[]) => {
        returning: (...args: unknown[]) => Promise<unknown>;
      };
    };
  };
  select: (...args: unknown[]) => {
    from: (...args: unknown[]) => {
      where: (...args: unknown[]) => Promise<Array<{ count: number }>>;
    };
  };
};

describe('UsersService', () => {
  function createUsersServiceFixture() {
    const findFirst = vi.fn();
    const findMany = vi.fn();
    const countWhere = vi.fn();
    const from = vi.fn(() => ({ where: countWhere }));
    const select = vi.fn(() => ({ from }));
    const returning = vi.fn();
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    const authService: Pick<AuthService, 'revokeAllRefreshTokensForUser'> = {
      revokeAllRefreshTokensForUser: vi.fn(async () => undefined),
    };

    const db = {
      query: {
        users: {
          findFirst,
        },
        globalLimits: {
          findMany,
        },
      },
      update,
      select,
    } satisfies UsersServiceDatabaseMock;

    const service = new UsersService(db as unknown as Database, authService as AuthService);
    return {
      service,
      findFirst,
      findMany,
      select,
      from,
      countWhere,
      update,
      set,
      where,
      returning,
      authService,
    };
  }

  it('GIVEN existing user id WHEN findById THEN returns mapped profile', async () => {
    const { service, findFirst } = createUsersServiceFixture();
    findFirst.mockResolvedValueOnce({
      id: '497f6eca-6276-4993-bfeb-53cbbbba6f08',
      email: 'user@example.com',
      username: 'alice',
      displayName: null,
      role: 'user',
      avatarUrl: null,
      bio: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });

    const result = await service.findById('497f6eca-6276-4993-bfeb-53cbbbba6f08');

    expect(result).toMatchObject({
      id: '497f6eca-6276-4993-bfeb-53cbbbba6f08',
      email: 'user@example.com',
      username: 'alice',
      role: 'user',
      stats: {
        totalSessions: 0,
        totalProblems: 0,
        streakDays: 0,
      },
    });
  });

  it('GIVEN unknown user id WHEN findById THEN throws not found with user code', async () => {
    const { service, findFirst } = createUsersServiceFixture();
    findFirst.mockResolvedValueOnce(null);

    await expect(service.findById('missing')).rejects.toMatchObject({
      response: {
        message: 'User not found',
        code: ERROR_CODES.USER_NOT_FOUND,
      },
    });
  });

  it('GIVEN existing user id WHEN findPublicById THEN returns public profile only', async () => {
    const { service, findFirst } = createUsersServiceFixture();
    findFirst.mockResolvedValueOnce({
      id: '497f6eca-6276-4993-bfeb-53cbbbba6f08',
      username: 'alice',
      displayName: 'Alice',
      avatarUrl: 'https://cdn.example.com/avatar.png',
      bio: 'hello',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await service.findPublicById('497f6eca-6276-4993-bfeb-53cbbbba6f08');

    expect(result).toEqual({
      id: '497f6eca-6276-4993-bfeb-53cbbbba6f08',
      username: 'alice',
      displayName: 'Alice',
      avatarUrl: 'https://cdn.example.com/avatar.png',
      bio: 'hello',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('GIVEN unknown user id WHEN findPublicById THEN throws not found with user code', async () => {
    const { service, findFirst } = createUsersServiceFixture();
    findFirst.mockResolvedValueOnce(null);

    await expect(service.findPublicById('missing')).rejects.toMatchObject({
      response: {
        message: 'User not found',
        code: ERROR_CODES.USER_NOT_FOUND,
      },
    });
  });

  it('GIVEN normalized email exists WHEN findByEmail THEN returns mapped profile', async () => {
    const { service, findFirst } = createUsersServiceFixture();
    findFirst.mockResolvedValueOnce({
      id: '497f6eca-6276-4993-bfeb-53cbbbba6f08',
      email: 'user@example.com',
      username: 'alice',
      displayName: 'Alice',
      role: 'user',
      avatarUrl: 'https://cdn.example.com/avatar.png',
      bio: 'hello',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });

    const result = await service.findByEmail('USER@example.com');

    expect(result?.email).toBe('user@example.com');
    expect(result?.displayName).toBe('Alice');
  });

  it('GIVEN no email match WHEN findByEmail THEN returns null', async () => {
    const { service, findFirst } = createUsersServiceFixture();
    findFirst.mockResolvedValueOnce(null);

    await expect(service.findByEmail('missing@example.com')).resolves.toBeNull();
  });

  it('GIVEN valid update payload WHEN update THEN returns mapped profile', async () => {
    const { service, findFirst, returning } = createUsersServiceFixture();
    findFirst.mockResolvedValueOnce(null);
    returning.mockResolvedValueOnce([
      {
        id: '497f6eca-6276-4993-bfeb-53cbbbba6f08',
        email: 'user@example.com',
        username: 'alice_doe',
        displayName: 'Alice Doe',
        role: 'user',
        avatarUrl: null,
        bio: 'Hello world',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      },
    ]);

    const result = await service.update('497f6eca-6276-4993-bfeb-53cbbbba6f08', {
      displayName: ' Alice Doe ',
      bio: ' Hello world ',
      username: 'alice_doe',
    });

    expect(result.username).toBe('alice_doe');
    expect(result.displayName).toBe('Alice Doe');
    expect(result.bio).toBe('Hello world');
  });

  it('GIVEN taken username WHEN update THEN throws conflict', async () => {
    const { service, findFirst } = createUsersServiceFixture();
    findFirst.mockResolvedValueOnce({ id: 'other-user' });

    await expect(
      service.update('497f6eca-6276-4993-bfeb-53cbbbba6f08', {
        username: 'alice_doe',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('GIVEN unique constraint race WHEN update THEN throws conflict', async () => {
    const { service, findFirst, returning } = createUsersServiceFixture();
    findFirst.mockResolvedValueOnce(null);
    returning.mockRejectedValueOnce({ code: '23505' });

    await expect(
      service.update('497f6eca-6276-4993-bfeb-53cbbbba6f08', {
        username: 'alice_doe',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('GIVEN existing user id WHEN delete THEN completes without error', async () => {
    const { service } = createUsersServiceFixture();

    await expect(service.delete('497f6eca-6276-4993-bfeb-53cbbbba6f08')).resolves.toBeUndefined();
  });
});
