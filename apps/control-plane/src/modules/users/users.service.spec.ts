import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { UsersService } from './users.service';

describe('UsersService', () => {
  function createUsersServiceFixture() {
    const findFirst = vi.fn();
    const db = {
      query: {
        users: {
          findFirst,
        },
      },
    };

    const service = new UsersService(db as never);
    return { service, findFirst };
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

  it('GIVEN unknown user id WHEN findById THEN throws not found', async () => {
    const { service, findFirst } = createUsersServiceFixture();
    findFirst.mockResolvedValueOnce(null);

    await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
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
});
