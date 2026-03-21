import { describe, expect, it, vi } from 'vitest';
import { UsersController } from './users.controller';

describe('UsersController', () => {
  function createUsersControllerFixture() {
    const usersService = {
      findById: vi.fn(async (id: string) => ({
        id,
        email: 'user@example.com',
        username: 'alice',
        displayName: null,
        role: 'user' as const,
        avatarUrl: null,
        bio: null,
        stats: {
          totalSessions: 0,
          totalProblems: 0,
          streakDays: 0,
        },
        createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
        updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      })),
    };

    const controller = new UsersController(usersService as never);

    return { controller, usersService };
  }

  it('GIVEN authenticated user WHEN getCurrentUser THEN returns profile by current id', async () => {
    const { controller, usersService } = createUsersControllerFixture();

    const result = await controller.getCurrentUser({ id: 'user-1' });

    expect(usersService.findById).toHaveBeenCalledWith('user-1');
    expect(result.id).toBe('user-1');
  });

  it('GIVEN requested user id WHEN getUserById THEN returns profile', async () => {
    const { controller, usersService } = createUsersControllerFixture();

    const result = await controller.getUserById('user-2');

    expect(usersService.findById).toHaveBeenCalledWith('user-2');
    expect(result.id).toBe('user-2');
  });
});
