import { describe, expect, it, vi } from 'vitest';
import { UsersController } from './users.controller.js';
import type { UsersService } from './users.service.js';

describe('UsersController', () => {
  function createUsersControllerFixture() {
    const usersService: Pick<
      UsersService,
      | 'confirmAvatarUpload'
      | 'delete'
      | 'deleteAvatar'
      | 'findById'
      | 'findPublicById'
      | 'getAvatarUploadUrl'
      | 'getQuotas'
      | 'update'
    > = {
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
      getQuotas: vi.fn(async () => ({
        ai: {
          used: 1,
          limit: 20,
          resetsAt: '2026-01-02T00:00:00.000Z',
        },
        execution: {
          used: 2,
          limit: 50,
          resetsAt: '2026-01-02T00:00:00.000Z',
        },
        rooms: {
          activeCount: 1,
          maxActive: 3,
        },
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
      getAvatarUploadUrl: vi.fn(async () => ({
        uploadUrl: 'https://s3.example.com/presigned-put',
        key: 'avatars/user-123.webp',
      })),
      confirmAvatarUpload: vi.fn(async (id: string) => ({
        id,
        email: 'user@example.com',
        username: 'alice',
        displayName: null,
        role: 'user' as const,
        avatarUrl: 'https://s3.example.com/presigned-get',
        bio: null,
        stats: { totalSessions: 0, totalProblems: 0, streakDays: 0 },
        createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
        updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      })),
      deleteAvatar: vi.fn(async () => undefined),
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

  it('GIVEN authenticated user WHEN getCurrentUserQuotas THEN returns quotas for current id', async () => {
    const { controller, usersService } = createUsersControllerFixture();

    const result = await controller.getCurrentUserQuotas({ id: 'user-1' });

    expect(usersService.getQuotas).toHaveBeenCalledWith('user-1');
    expect(result.ai.used).toBe(1);
    expect(result.rooms.maxActive).toBe(3);
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

  it('GIVEN authenticated user WHEN getAvatarUploadUrl THEN returns presigned URL and key', async () => {
    const { controller } = createUsersControllerFixture();

    const result = await controller.getAvatarUploadUrl({ id: 'user-123' });

    expect(result).toEqual({
      uploadUrl: 'https://s3.example.com/presigned-put',
      key: 'avatars/user-123.webp',
    });
  });

  it('GIVEN authenticated user WHEN confirmAvatarUpload THEN returns updated profile with avatar URL', async () => {
    const { controller } = createUsersControllerFixture();

    const result = await controller.confirmAvatarUpload({ id: 'user-123' });

    expect(result.avatarUrl).toBe('https://s3.example.com/presigned-get');
  });

  it('GIVEN authenticated user WHEN deleteAvatar THEN delegates to service', async () => {
    const { controller, usersService } = createUsersControllerFixture();

    await controller.deleteAvatar({ id: 'user-123' });

    expect(usersService.deleteAvatar).toHaveBeenCalledWith('user-123');
  });
});
