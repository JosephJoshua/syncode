import { Test } from '@nestjs/testing';
import {
  AI_CODE_ANALYSIS_QUEUE,
  AI_CODE_ANALYSIS_RESULT_QUEUE,
  AI_HINT_QUEUE,
  AI_HINT_RESULT_QUEUE,
  AI_INTERVIEW_QUEUE,
  AI_INTERVIEW_RESULT_QUEUE,
  AI_REVIEW_QUEUE,
  AI_REVIEW_RESULT_QUEUE,
  AI_SESSION_REPORT_QUEUE,
  AI_SESSION_REPORT_RESULT_QUEUE,
  AI_WEAKNESS_ANALYSIS_QUEUE,
  AI_WEAKNESS_ANALYSIS_RESULT_QUEUE,
} from '@syncode/contracts';
import type { IQueueService, IStorageService, QueueJob } from '@syncode/shared/ports';
import { QUEUE_SERVICE, STORAGE_SERVICE } from '@syncode/shared/ports';
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

function createMockStorageService(): IStorageService {
  return {
    upload: vi.fn().mockResolvedValue(undefined),
    download: vi.fn().mockResolvedValue(Buffer.from('')),
    delete: vi.fn().mockResolvedValue(undefined),
    deleteMany: vi.fn().mockResolvedValue({ deleted: [], failed: [] }),
    exists: vi.fn().mockResolvedValue(true),
    getMetadata: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue({ keys: [], isTruncated: false }),
    copy: vi.fn().mockResolvedValue(undefined),
    getUploadUrl: vi.fn().mockResolvedValue('https://storage.example/upload'),
    getDownloadUrl: vi.fn().mockResolvedValue('https://storage.example/interview-audio.mp3'),
    shutdown: vi.fn().mockResolvedValue(undefined),
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
            generateText: vi
              .fn()
              .mockImplementation(async (input: { maxOutputTokens?: number }) => {
                if (input.maxOutputTokens === 600) {
                  return {
                    text: JSON.stringify({
                      message: 'Can you explain the invariant your map maintains?',
                      followUpQuestion:
                        'Why is checking the complement before inserting the current value safe?',
                      codeAnnotations: [{ line: 1, comment: 'Name the state you are tracking.' }],
                    }),
                    model: 'qwen3.5-mini',
                  };
                }

                if (input.maxOutputTokens === 700) {
                  return {
                    text: JSON.stringify({
                      summary:
                        'The implementation should be discussed through complexity, edge cases, and readability.',
                      focusAreas: {
                        complexity: 'Ask the candidate to justify the dominant operation.',
                        edgeCases: 'Probe empty input and duplicate-value behavior.',
                        readability: 'Ask which state names make the approach easiest to explain.',
                      },
                      followUpQuestions: [
                        'What operation dominates the time complexity?',
                        'Which duplicate-value case would you test first?',
                      ],
                    }),
                    model: 'qwen3.5-mini',
                  };
                }

                if (input.maxOutputTokens === 900) {
                  return {
                    text: JSON.stringify({
                      summary: 'Edge-case reasoning and communication need repeated attention.',
                      recurringPatterns: [
                        'Boundary cases are discussed after implementation instead of before.',
                      ],
                      weaknesses: [
                        {
                          category: 'edge_cases',
                          description:
                            'The candidate should identify boundary cases before submitting.',
                          evidence:
                            'The session included a submission before edge cases were named.',
                          trend: 'stable',
                        },
                      ],
                    }),
                    model: 'qwen3.5-mini',
                  };
                }

                if (input.maxOutputTokens === 2500) {
                  return {
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
                  };
                }

                return {
                  text: JSON.stringify({
                    hint: 'Consider storing seen values in a map.',
                    suggestedApproach: 'Track complement values while iterating.',
                  }),
                  model: 'qwen3.5-mini',
                };
              }),
            generateSpeech: vi.fn().mockResolvedValue({
              audio: Buffer.from('speech-bytes'),
              model: 'qwen-tts',
              mimeType: 'audio/mpeg',
            }),
          },
        },
        {
          provide: STORAGE_SERVICE,
          useValue: createMockStorageService(),
        },
      ],
    }).compile();

    processor = module.get(AiProcessor);
  });

  describe('onModuleInit', () => {
    it('GIVEN the processor WHEN onModuleInit is called THEN registers handlers on all 6 queues', () => {
      processor.onModuleInit();

      expect(mockQueueService.process).toHaveBeenCalledTimes(6);
      expect(handlers.has(AI_HINT_QUEUE)).toBe(true);
      expect(handlers.has(AI_CODE_ANALYSIS_QUEUE)).toBe(true);
      expect(handlers.has(AI_WEAKNESS_ANALYSIS_QUEUE)).toBe(true);
      expect(handlers.has(AI_REVIEW_QUEUE)).toBe(true);
      expect(handlers.has(AI_INTERVIEW_QUEUE)).toBe(true);
      expect(handlers.has(AI_SESSION_REPORT_QUEUE)).toBe(true);

      const sessionReportProcessCall = mockQueueService.process.mock.calls.find(
        ([queueName]) => queueName === AI_SESSION_REPORT_QUEUE,
      );

      expect(sessionReportProcessCall?.[2]).toEqual({ concurrency: 1 });
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

  describe('code analysis job processing', () => {
    it('GIVEN a code analysis job WHEN the handler processes it THEN enqueues result to AI_CODE_ANALYSIS_RESULT_QUEUE with jobId', async () => {
      processor.onModuleInit();
      mockQueueService.enqueue.mockClear();

      const handler = handlers.get(AI_CODE_ANALYSIS_QUEUE)!;
      const job = createFakeJob(
        {
          roomId: 'room-1',
          participantId: 'user-1',
          problemDescription: 'Two Sum',
          code: 'function twoSum(nums, target) { return []; }',
          language: 'typescript',
        },
        'code-analysis-job-1',
      );

      await handler(job);

      expect(mockQueueService.enqueue).toHaveBeenCalledWith(
        AI_CODE_ANALYSIS_RESULT_QUEUE,
        'code-analysis-result',
        expect.objectContaining({
          jobId: 'code-analysis-job-1',
          summary: expect.any(String),
          followUpQuestions: expect.any(Array),
        }),
      );
    });
  });

  describe('weakness analysis job processing', () => {
    it('GIVEN a weakness analysis job WHEN the handler processes it THEN enqueues result to AI_WEAKNESS_ANALYSIS_RESULT_QUEUE with jobId', async () => {
      processor.onModuleInit();
      mockQueueService.enqueue.mockClear();

      const handler = handlers.get(AI_WEAKNESS_ANALYSIS_QUEUE)!;
      const job = createFakeJob(
        {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          roomId: '660e8400-e29b-41d4-a716-446655440000',
          participantId: '770e8400-e29b-41d4-a716-446655440000',
          participantRole: 'candidate',
          problem: {
            id: '880e8400-e29b-41d4-a716-446655440000',
            title: 'Two Sum',
            description: 'Find two numbers.',
            difficulty: 'easy',
            constraints: null,
          },
          language: 'typescript',
          durationMs: 120000,
          snapshots: [],
          runs: [],
          submissions: [],
          peerFeedback: [],
          aiMessages: [],
          sessionReportSummary: {
            overallScore: 72,
            feedback: 'Candidate solved the main case but discussed edge cases late.',
          },
          historicalWeaknesses: [],
        },
        'weakness-analysis-job-1',
      );

      await handler(job);

      expect(mockQueueService.enqueue).toHaveBeenCalledWith(
        AI_WEAKNESS_ANALYSIS_RESULT_QUEUE,
        'weakness-analysis-result',
        expect.objectContaining({
          jobId: 'weakness-analysis-job-1',
          summary: expect.any(String),
          recurringPatterns: expect.any(Array),
          weaknesses: expect.any(Array),
        }),
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
          message: 'Can you explain the invariant your map maintains?',
          followUpQuestion:
            'Why is checking the complement before inserting the current value safe?',
          codeAnnotations: [{ line: 1, comment: 'Name the state you are tracking.' }],
          audio: expect.objectContaining({
            downloadUrl: 'https://storage.example/interview-audio.mp3',
          }),
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
          testCaseBreakdown: [
            expect.objectContaining({
              testCaseIndex: 0,
              passed: true,
              timedOut: false,
              errorMessage: null,
            }),
          ],
        }),
      );
    });
  });
});
