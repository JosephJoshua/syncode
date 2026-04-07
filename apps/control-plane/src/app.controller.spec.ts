import { Test } from '@nestjs/testing';
import { AI_CLIENT, COLLAB_CLIENT, EXECUTION_CLIENT } from '@syncode/contracts';
import { CACHE_SERVICE, QUEUE_SERVICE, STORAGE_SERVICE } from '@syncode/shared/ports';
import { describe, expect, it, vi } from 'vitest';
import { AppController } from './app.controller.js';

function createMocks() {
  return {
    queueService: {
      getQueueStats: vi.fn().mockResolvedValue({}),
      enqueue: vi.fn(),
    },
    cacheService: {
      exists: vi.fn().mockResolvedValue(true),
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
    },
    storageService: {
      exists: vi.fn().mockResolvedValue(true),
      upload: vi.fn(),
      download: vi.fn(),
      delete: vi.fn(),
    },
    executionClient: {
      healthCheck: vi.fn().mockResolvedValue(true),
    },
    aiClient: {
      healthCheck: vi.fn().mockResolvedValue(true),
    },
    collabClient: {
      healthCheck: vi.fn().mockResolvedValue(true),
    },
  };
}

async function createController(mocks: ReturnType<typeof createMocks>) {
  const module = await Test.createTestingModule({
    controllers: [AppController],
    providers: [
      { provide: QUEUE_SERVICE, useValue: mocks.queueService },
      { provide: CACHE_SERVICE, useValue: mocks.cacheService },
      { provide: STORAGE_SERVICE, useValue: mocks.storageService },
      { provide: EXECUTION_CLIENT, useValue: mocks.executionClient },
      { provide: AI_CLIENT, useValue: mocks.aiClient },
      { provide: COLLAB_CLIENT, useValue: mocks.collabClient },
    ],
  }).compile();

  return module.get(AppController);
}

describe('AppController', () => {
  it('GIVEN all services healthy WHEN healthCheck THEN returns status ok with all services ok', async () => {
    const mocks = createMocks();
    const controller = await createController(mocks);

    const result = await controller.healthCheck();

    expect(result.status).toBe('ok');
    expect(result.services).toEqual({
      queue: 'ok',
      cache: 'ok',
      storage: 'ok',
      execution: 'ok',
      ai: 'ok',
      collab: 'ok',
    });
    expect(result.timestamp).toBeDefined();
  });

  it('GIVEN one service fails WHEN healthCheck THEN returns status degraded with that service fail and others ok', async () => {
    const mocks = createMocks();
    mocks.cacheService.exists.mockRejectedValue(new Error('Redis down'));
    const controller = await createController(mocks);

    const result = await controller.healthCheck();

    expect(result.status).toBe('degraded');
    expect(result.services.cache).toBe('fail');
    expect(result.services.queue).toBe('ok');
    expect(result.services.storage).toBe('ok');
    expect(result.services.execution).toBe('ok');
    expect(result.services.ai).toBe('ok');
    expect(result.services.collab).toBe('ok');
  });

  it('GIVEN a health client returns false WHEN healthCheck THEN that service is fail', async () => {
    const mocks = createMocks();
    mocks.executionClient.healthCheck.mockResolvedValue(false);
    const controller = await createController(mocks);

    const result = await controller.healthCheck();

    expect(result.status).toBe('degraded');
    expect(result.services.execution).toBe('fail');
    expect(result.services.queue).toBe('ok');
    expect(result.services.cache).toBe('ok');
    expect(result.services.storage).toBe('ok');
    expect(result.services.ai).toBe('ok');
    expect(result.services.collab).toBe('ok');
  });

  it('GIVEN all services fail WHEN healthCheck THEN returns degraded with all services fail', async () => {
    const mocks = createMocks();
    mocks.queueService.getQueueStats.mockRejectedValue(new Error('down'));
    mocks.cacheService.exists.mockRejectedValue(new Error('down'));
    mocks.storageService.exists.mockRejectedValue(new Error('down'));
    mocks.executionClient.healthCheck.mockRejectedValue(new Error('down'));
    mocks.aiClient.healthCheck.mockRejectedValue(new Error('down'));
    mocks.collabClient.healthCheck.mockRejectedValue(new Error('down'));
    const controller = await createController(mocks);

    const result = await controller.healthCheck();

    expect(result.status).toBe('degraded');
    expect(result.services).toEqual({
      queue: 'fail',
      cache: 'fail',
      storage: 'fail',
      execution: 'fail',
      ai: 'fail',
      collab: 'fail',
    });
  });
});
