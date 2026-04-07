import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { AuthController } from './auth.controller.js';
import type { AuthService } from './auth.service.js';

describe('AuthController', () => {
  function createController() {
    const authService = {
      register: vi.fn(async () => ({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: {
          id: '497f6eca-6276-4993-bfeb-53cbbbba6f08',
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
        },
      })),
      login: vi.fn(async () => ({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: {
          id: '497f6eca-6276-4993-bfeb-53cbbbba6f08',
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
        },
      })),
      refreshToken: vi.fn(async () => ({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      })),
      logout: vi.fn(async () => undefined),
    } satisfies Pick<AuthService, 'login' | 'logout' | 'refreshToken' | 'register'>;

    const configService = {
      get: vi.fn((key: string) => (key === 'NODE_ENV' ? 'test' : undefined)),
    } as unknown as ConfigService;

    const controller = new AuthController(authService as AuthService, configService);
    const response = {
      cookie: vi.fn(),
    } satisfies Pick<Response, 'cookie'>;

    return { controller, authService, response };
  }

  it('GIVEN register request WHEN successful THEN returns payload and sets refresh cookie', async () => {
    const { controller, response } = createController();

    const result = await controller.register(
      {
        username: 'alice',
        email: 'alice@example.com',
        password: 'secret123',
      },
      response as Response,
    );

    expect(result.accessToken).toBe('access-token');
    expect(result.user.username).toBe('alice');
    expect(response.cookie).toHaveBeenCalledTimes(1);
  });

  it('GIVEN login request WHEN successful THEN returns payload and sets refresh cookie', async () => {
    const { controller, response } = createController();

    const result = await controller.login(
      {
        identifier: 'alice',
        password: 'secret123',
      },
      response as Response,
    );

    expect(result.accessToken).toBe('access-token');
    expect(result.user.email).toBe('user@example.com');
    expect(response.cookie).toHaveBeenCalledTimes(1);
  });

  it('GIVEN missing refresh cookie WHEN refreshing THEN throws unauthorized', async () => {
    const { controller, response } = createController();

    await expect(controller.refresh(undefined, response as Response)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('GIVEN refresh cookie WHEN refreshing THEN rotates and sets refresh cookie', async () => {
    const { controller, response, authService } = createController();

    const result = await controller.refresh('refresh-token', response as Response);

    expect(authService.refreshToken).toHaveBeenCalledWith('refresh-token');
    expect(result.accessToken).toBe('new-access-token');
    expect(response.cookie).toHaveBeenCalledTimes(1);
  });

  it('GIVEN refresh cookie WHEN logging out THEN clears refresh cookie', async () => {
    const { controller, response, authService } = createController();

    await controller.logout('refresh-token', response as Response);

    expect(authService.logout).toHaveBeenCalledWith('refresh-token');
    expect(response.cookie).toHaveBeenCalledTimes(1);
    expect(response.cookie).toHaveBeenCalledWith(
      'refreshToken',
      '',
      expect.objectContaining({ maxAge: 0 }),
    );
  });
});
