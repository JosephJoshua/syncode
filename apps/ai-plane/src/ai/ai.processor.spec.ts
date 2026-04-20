import { Test } from '@nestjs/testing';
import {
  AI_HINT_QUEUE,
  AI_HINT_RESULT_QUEUE,
  AI_INTERVIEW_QUEUE,
  AI_INTERVIEW_RESULT_QUEUE,
  AI_REVIEW_QUEUE,
  AI_REVIEW_RESULT_QUEUE,
  AI_SESSION_REPORT_QUEUE,
  AI_SESSION_REPORT_RESULT_QUEUE,
} from '@syncode/contracts';
import type { IQueueService, QueueJob } from '@syncode/shared/ports';
import { QUEUE_SERVICE } from '@syncode/shared/ports';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { LLM_PROVIDER } from '../llm/llm.constants.js';
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
      providers: [
        AiProcessor,
        AiService,
        { provide: QUEUE_SERVICE, useValue: mockQueueService },
        {
          provide: LLM_PROVIDER,
          useValue: {
            generateText: vi.fn().mockResolvedValue({
              text: JSON.stringify({
                overallScore: 82,
                dimensions: {
                  correctness: { score: 84, feedback: 'Correctness', evidence: [] },
                  efficiency: { score: 78, feedback: 'Efficiency', evidence: [] },
                  codeQuality: { score: 80, feedback: 'Code quality', evidence: [] },
                  communication: { score: 76, feedback: 'Communication', evidence: [] },
                  problemSolving: { score: 83, feedback: 'Problem solving', evidence: [] },
                },
                strengths: ['Strong iteration'],
                areasForImprovement: ['Explain tradeoffs earlier'],
                detailedFeedback: 'Detailed feedback',
                comparisonToHistory: null,
                peerFeedbackSummary: null,
              }),
              model: 'qwen3.5-mini',
            }),
          },
        },
      ],
    }).compile();

    processor = module.get(AiProcessor);
  });

  describe('onModuleInit', () => {
    it('GIVEN the processor WHEN onModuleInit is called THEN registers handlers on all 4 queues', () => {
      processor.onModuleInit();

      expect(mockQueueService.process).toHaveBeenCalledTimes(4);
      expect(handlers.has(AI_HINT_QUEUE)).toBe(true);
      expect(handlers.has(AI_REVIEW_QUEUE)).toBe(true);
      expect(handlers.has(AI_INTERVIEW_QUEUE)).toBe(true);
      expect(handlers.has(AI_SESSION_REPORT_QUEUE)).toBe(true);
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

  describe('session report job processing', () => {
    it('GIVEN a session report job WHEN the handler processes it THEN enqueues result to AI_SESSION_REPORT_RESULT_QUEUE with jobId', async () => {
      processor.onModuleInit();
      mockQueueService.enqueue.mockClear();

      const handler = handlers.get(AI_SESSION_REPORT_QUEUE)!;
      const job = createFakeJob(
        {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          roomId: '660e8400-e29b-41d4-a716-446655440000',
          participantId: '770e8400-e29b-41d4-a716-446655440000',
          participantRole: 'candidate',
          participants: [
            {
              userId: '770e8400-e29b-41d4-a716-446655440000',
              username: 'alice',
              displayName: 'Alice',
              role: 'candidate',
            },
          ],
          problem: {
            id: '880e8400-e29b-41d4-a716-446655440000',
            title: 'Two Sum',
            description: 'Find two numbers.',
            difficulty: 'easy',
            constraints: null,
          },
          language: 'typescript',
          durationMs: 120000,
          startedAt: '2026-04-20T01:00:00.000Z',
          finishedAt: '2026-04-20T01:02:00.000Z',
          snapshots: [],
          runs: [],
          submissions: [],
          finalTestCaseBreakdown: [
            {
              testCaseIndex: 0,
              input: 'nums = [2,7,11,15], target = 9',
              description: 'Basic case',
              isHidden: false,
              passed: true,
              expectedOutput: '[0,1]',
              actualOutput: '[0,1]',
              stdout: '[0,1]\\n',
              stderr: '',
              exitCode: 0,
              durationMs: 12,
              memoryUsageMb: 8.5,
              timedOut: false,
              errorMessage: null,
            },
          ],
          peerFeedback: [],
          aiMessages: [],
          historicalContext: null,
        },
        'session-report-job-1',
      );

      await handler(job);

      expect(mockQueueService.enqueue).toHaveBeenCalledWith(
        AI_SESSION_REPORT_RESULT_QUEUE,
        'session-report-result',
        expect.objectContaining({
          jobId: 'session-report-job-1',
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          overallScore: expect.any(Number),
          testCaseBreakdown: expect.any(Array),
        }),
      );
    });
  });
});
