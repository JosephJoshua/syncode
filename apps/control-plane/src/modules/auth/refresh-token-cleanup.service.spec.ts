import { describe, expect, it, vi } from 'vitest';
import type { AuthService } from './auth.service.js';
import { RefreshTokenCleanupService } from './refresh-token-cleanup.service.js';

describe('RefreshTokenCleanupService', () => {
  it('GIVEN scheduled cleanup WHEN triggered THEN delegates to auth service', async () => {
    const authService: Pick<AuthService, 'cleanupExpiredRefreshTokens'> = {
      cleanupExpiredRefreshTokens: vi.fn(async () => undefined),
    };

    const service = new RefreshTokenCleanupService(authService as AuthService);

    await service.cleanupExpiredRefreshTokens();

    expect(authService.cleanupExpiredRefreshTokens).toHaveBeenCalledOnce();
  });
});
