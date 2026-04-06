import { describe, expect, it, vi } from 'vitest';
import { UsersController } from './users.controller';
import type { UsersService } from './users.service';

describe('UsersController', () => {
  function createUsersControllerFixture() {
    const usersService: Pick<UsersService, 'delete' | 'findById' | 'findPublicById' | 'update'> = {
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
      findPublicById: vi.fn(async (id: string) => ({
        id,
        username: 'alice',
        displayName: null,
        avatarUrl: null,
        bio: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      })),
      update: vi.fn(
        async (id: string, body: { displayName?: string; bio?: string; username?: string }) => ({
          id,
          email: 'user@example.com',
          username: body.username ?? 'alice',
          displayName: body.displayName ?? null,
          role: 'user' as const,
          avatarUrl: null,
          bio: body.bio ?? null,
          stats: {
            totalSessions: 0,
            totalProblems: 0,
            streakDays: 0,
          },
          createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
          updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
        }),
      ),
      delete: vi.fn(async () => undefined),
    };

    const controller = new UsersController(usersService as UsersService);

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

    expect(usersService.findPublicById).toHaveBeenCalledWith('user-2');
    expect(result.id).toBe('user-2');
    expect(result).not.toHaveProperty('email');
  });

  it('GIVEN authenticated user WHEN updateCurrentUser THEN delegates to service and returns updated profile', async () => {
    const { controller, usersService } = createUsersControllerFixture();

    const result = await controller.updateCurrentUser(
      { id: 'user-3' },
      {
        displayName: 'Alice Doe',
        bio: 'Hello world',
        username: 'alice_doe',
      },
    );

    expect(usersService.update).toHaveBeenCalledWith('user-3', {
      displayName: 'Alice Doe',
      bio: 'Hello world',
      username: 'alice_doe',
    });
    expect(result.id).toBe('user-3');
    expect(result.username).toBe('alice_doe');
  });

  it('GIVEN authenticated user WHEN deleteCurrentUser THEN delegates to service', async () => {
    const { controller, usersService } = createUsersControllerFixture();

    await controller.deleteCurrentUser({ id: 'user-4' });

    expect(usersService.delete).toHaveBeenCalledWith('user-4');
  });
});
