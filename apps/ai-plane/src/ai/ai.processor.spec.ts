import { Test } from '@nestjs/testing';
import {
  AI_HINT_QUEUE,
  AI_HINT_RESULT_QUEUE,
  AI_INTERVIEW_QUEUE,
  AI_INTERVIEW_RESULT_QUEUE,
  AI_REVIEW_QUEUE,
  AI_REVIEW_RESULT_QUEUE,
} from '@syncode/contracts';
import type { IQueueService, QueueJob } from '@syncode/shared/ports';
import { QUEUE_SERVICE } from '@syncode/shared/ports';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { AiProcessor } from './ai.processor.js';
import { AiService } from './ai.service.js';

function createMockQueueService() {
  const handlers = new Map<string, (job: QueueJob) => Promise<void>>();

  const mock: Record<keyof IQueueService, ReturnType<typeof vi.fn>> = {
    process: vi.fn((queueName: string, handler: (job: QueueJob) => Promise<void>) => {
      handlers.set(queueName, handler);
    }),
    enqueue: vi.fn().mockResolvedValue('result-job-id'),
    enqueueBulk: vi.fn().mockResolvedValue([]),
    getJob: vi.fn().mockResolvedValue(null),
    getDeadLetterJobs: vi.fn().mockResolvedValue([]),
    retryDeadLetterJob: vi.fn().mockResolvedValue(undefined),
    retryAllDeadLetterJobs: vi.fn().mockResolvedValue(0),
    purgeDeadLetterQueue: vi.fn().mockResolvedValue(0),
    getQueueStats: vi.fn().mockResolvedValue({
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
    }),
    drain: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
    registerEventHandlers: vi.fn(),
  };

  return { mock, handlers };
}

function createFakeJob<T>(data: T, id = 'job-123'): QueueJob<T> {
  return {
    id,
    name: 'test-job',
    data,
    attemptsMade: 0,
    maxAttempts: 3,
    timestamp: Date.now(),
  };
}

describe('AiProcessor', () => {
  const { mock: mockQueueService, handlers } = createMockQueueService();

  let processor: AiProcessor;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [AiProcessor, AiService, { provide: QUEUE_SERVICE, useValue: mockQueueService }],
    }).compile();

    processor = module.get(AiProcessor);
  });

  describe('onModuleInit', () => {
    it('GIVEN the processor WHEN onModuleInit is called THEN registers handlers on all 3 queues', () => {
      processor.onModuleInit();

      expect(mockQueueService.process).toHaveBeenCalledTimes(3);
      expect(handlers.has(AI_HINT_QUEUE)).toBe(true);
      expect(handlers.has(AI_REVIEW_QUEUE)).toBe(true);
      expect(handlers.has(AI_INTERVIEW_QUEUE)).toBe(true);
    });
  });

  describe('hint job processing', () => {
    it('GIVEN a hint job WHEN the handler processes it THEN enqueues result to AI_HINT_RESULT_QUEUE with jobId', async () => {
      processor.onModuleInit();

      const handler = handlers.get(AI_HINT_QUEUE)!;
      const job = createFakeJob(
        {
          roomId: 'room-1',
          participantId: 'user-1',
          problemDescription: 'Two Sum',
          currentCode: 'function twoSum() {}',
          language: 'typescript',
          hintLevel: 'gentle',
        },
        'hint-job-1',
      );

      await handler(job);

      expect(mockQueueService.enqueue).toHaveBeenCalledWith(
        AI_HINT_RESULT_QUEUE,
        'hint-result',
        expect.objectContaining({ jobId: 'hint-job-1', hint: expect.any(String) }),
      );
    });
  });

  describe('review job processing', () => {
    it('GIVEN a review job WHEN the handler processes it THEN enqueues result to AI_REVIEW_RESULT_QUEUE with jobId', async () => {
      processor.onModuleInit();
      mockQueueService.enqueue.mockClear();

      const handler = handlers.get(AI_REVIEW_QUEUE)!;
      const job = createFakeJob(
        {
          roomId: 'room-1',
          participantId: 'user-1',
          problemDescription: 'Two Sum',
          code: 'function twoSum() { return [0, 1]; }',
          language: 'typescript',
        },
        'review-job-1',
      );

      await handler(job);

      expect(mockQueueService.enqueue).toHaveBeenCalledWith(
        AI_REVIEW_RESULT_QUEUE,
        'review-result',
        expect.objectContaining({
          jobId: 'review-job-1',
          overallScore: expect.any(Number),
          categories: expect.any(Array),
        }),
      );
    });
  });

  describe('interview job processing', () => {
    it('GIVEN an interview job WHEN the handler processes it THEN enqueues result to AI_INTERVIEW_RESULT_QUEUE with jobId', async () => {
      processor.onModuleInit();
      mockQueueService.enqueue.mockClear();

      const handler = handlers.get(AI_INTERVIEW_QUEUE)!;
      const job = createFakeJob(
        {
          roomId: 'room-1',
          participantId: 'user-1',
          problemDescription: 'Two Sum',
          currentCode: 'function twoSum() {}',
          language: 'typescript',
          conversationHistory: [],
          userMessage: 'I will use a hash map.',
        },
        'interview-job-1',
      );

      await handler(job);

      expect(mockQueueService.enqueue).toHaveBeenCalledWith(
        AI_INTERVIEW_RESULT_QUEUE,
        'interview-result',
        expect.objectContaining({
          jobId: 'interview-job-1',
          message: expect.any(String),
        }),
      );
    });
  });
});
