import { describe, expect, it, vi } from 'vitest';
import { RefreshTokenCleanupService } from './refresh-token-cleanup.service';

describe('RefreshTokenCleanupService', () => {
  it('GIVEN scheduled cleanup WHEN triggered THEN delegates to auth service', async () => {
    const authService = {
      cleanupExpiredRefreshTokens: vi.fn(async () => undefined),
    };

    const service = new RefreshTokenCleanupService(authService as never);

    await service.cleanupExpiredRefreshTokens();

    expect(authService.cleanupExpiredRefreshTokens).toHaveBeenCalledOnce();
  });
});
