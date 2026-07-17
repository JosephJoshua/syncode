import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@/modules/auth/auth.types.js';
import { MatchmakingController } from './matchmaking.controller.js';
import { MatchmakingService } from './matchmaking.service.js';

describe('MatchmakingController', () => {
  let controller: MatchmakingController;
  let service: {
    enterQueue: ReturnType<typeof vi.fn>;
    leaveQueue: ReturnType<typeof vi.fn>;
    getQueueStatus: ReturnType<typeof vi.fn>;
  };
  const user: AuthUser = { id: 'user-1', email: 'user@test.com' };

  beforeEach(async () => {
    service = {
      enterQueue: vi.fn(),
      leaveQueue: vi.fn(),
      getQueueStatus: vi.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [MatchmakingController],
      providers: [{ provide: MatchmakingService, useValue: service }],
    }).compile();

    controller = module.get(MatchmakingController);
  });

  it('GIVEN queue preferences WHEN entering queue THEN returns service response', async () => {
    service.enterQueue.mockResolvedValue({
      status: 'searching',
      requestId: '550e8400-e29b-41d4-a716-446655440001',
      queuePosition: 1,
      expiresAt: '2026-05-18T12:00:00.000Z',
      preferences: {
        languages: ['python'],
        difficulties: [],
        problemIds: [],
        topics: [],
        roles: [],
      },
    });

    const result = await controller.enterQueue(user, {
      languages: ['python'],
      difficulties: [],
      problemIds: [],
      topics: [],
      roles: [],
    });

    expect(service.enterQueue).toHaveBeenCalledWith(user.id, {
      languages: ['python'],
      difficulties: [],
      problemIds: [],
      topics: [],
      roles: [],
    });
    expect(result.status).toBe('searching');
  });

  it('GIVEN active queue WHEN leaving queue THEN returns idle', async () => {
    service.leaveQueue.mockResolvedValue({ status: 'idle' });

    await expect(controller.leaveQueue(user)).resolves.toEqual({ status: 'idle' });
    expect(service.leaveQueue).toHaveBeenCalledWith(user.id);
  });

  it('GIVEN queue status request WHEN reading status THEN returns service response', async () => {
    service.getQueueStatus.mockResolvedValue({
      status: 'matched',
      requestId: '550e8400-e29b-41d4-a716-446655440001',
      roomId: '550e8400-e29b-41d4-a716-446655440002',
      matchedWithUserId: '550e8400-e29b-41d4-a716-446655440003',
      expiresAt: '2026-05-18T12:00:00.000Z',
      preferences: {
        languages: ['python'],
        difficulties: ['easy'],
        problemIds: [],
        topics: [],
        roles: [],
      },
    });

    await expect(controller.getQueueStatus(user)).resolves.toMatchObject({ status: 'matched' });
    expect(service.getQueueStatus).toHaveBeenCalledWith(user.id);
  });
});
