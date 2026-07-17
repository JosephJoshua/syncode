import {
  AI_CODE_ANALYSIS_RESULT_QUEUE,
  AI_HINT_RESULT_QUEUE,
  AI_INTERVIEW_RESULT_QUEUE,
  AI_INTERVIEW_TRANSCRIPTION_QUEUE,
  AI_INTERVIEW_TRANSCRIPTION_RESULT_QUEUE,
  AI_SESSION_REPORT_RESULT_QUEUE,
  AI_WEAKNESS_ANALYSIS_RESULT_QUEUE,
  type AnalyzeCodeResult,
  type GenerateHintResult,
  type GenerateSessionReportResult,
  type GenerateWeaknessAnalysisResult,
  type InterviewResponseResult,
  type InterviewTranscriptionRequest,
  type InterviewTranscriptionResult,
  type JobId,
} from '@syncode/contracts';
import type { ICacheService, IQueueService, QueueJob, QueueStats } from '@syncode/shared/ports';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueueAiClient } from './queue-ai.client';

describe('QueueAiClient', () => {
  const handlers = new Map<string, (job: QueueJob<Record<string, unknown>>) => Promise<void>>();
  const jobs = new Map<string, QueueJob<Record<string, unknown>>>();
  const cacheEntries = new Map<string, unknown>();
  const queueStats: QueueStats = {
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
    paused: 0,
  };
  const queueService = {
    enqueue: vi.fn(async () => 'job-1'),
    process: vi.fn(
      (queue: string, handler: (job: QueueJob<Record<string, unknown>>) => Promise<void>) => {
        handlers.set(queue, handler);
      },
    ),
    getJob: vi.fn(async (queueName: string, jobId: string) => {
      return jobs.get(`${queueName}:${jobId}`) ?? null;
    }),
    getQueueStats: vi.fn(async () => queueStats),
  } as unknown as IQueueService;
  const cacheService = {
    set: vi.fn(async (key: string, value: unknown) => {
      cacheEntries.set(key, value);
    }),
    get: vi.fn(async <T>(key: string) => (cacheEntries.get(key) as T | undefined) ?? null),
    exists: vi.fn(async (key: string) => cacheEntries.has(key)),
  } as unknown as ICacheService;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers.clear();
    jobs.clear();
    cacheEntries.clear();
  });

  it('GIVEN same raw job id across AI queues WHEN results arrive THEN each result is cached in its job-type namespace', async () => {
    const client = new QueueAiClient(queueService, cacheService);
    await client.onModuleInit();
    const hintResult: GenerateHintResult & { jobId: string } = {
      jobId: '1',
      hint: 'Try a lookup table.',
    };
    const analysisResult: AnalyzeCodeResult & { jobId: string } = {
      jobId: '1',
      summary: 'Discuss complexity and edge cases.',
      focusAreas: {
        complexity: 'Ask for time and space complexity.',
        edgeCases: 'Ask about empty input.',
        readability: 'Ask about variable names.',
      },
      followUpQuestions: ['What is the complexity?'],
    };
    const weaknessResult: GenerateWeaknessAnalysisResult & { jobId: string } = {
      jobId: '1',
      sessionId: 'session-1',
      participantId: 'user-1',
      reportedAt: '2026-04-20T06:00:00.000Z',
      summary: 'Track edge-case reasoning over time.',
      recurringPatterns: ['Edge cases are discussed after implementation.'],
      weaknesses: [
        {
          category: 'edge_cases',
          description: 'Boundary cases should be named before final submission.',
          evidence: 'The session did not show explicit empty-input validation.',
          trend: 'stable',
        },
      ],
    };

    await handlers.get(AI_HINT_RESULT_QUEUE)!({ data: hintResult } as QueueJob<
      Record<string, unknown>
    >);
    await handlers.get(AI_CODE_ANALYSIS_RESULT_QUEUE)!({ data: analysisResult } as QueueJob<
      Record<string, unknown>
    >);
    await handlers.get(AI_WEAKNESS_ANALYSIS_RESULT_QUEUE)!({
      data: weaknessResult,
    } as QueueJob<Record<string, unknown>>);

    expect(cacheService.set).toHaveBeenCalledWith('ai-result:hint:1', hintResult, 86_400);
    expect(cacheService.set).toHaveBeenCalledWith(
      'ai-result:code-analysis:1',
      analysisResult,
      86_400,
    );
    expect(cacheService.set).toHaveBeenCalledWith(
      'ai-result:weakness-analysis:1',
      weaknessResult,
      86_400,
    );
    await expect(client.getHintResult('1' as JobId<'ai:hint'>)).resolves.toEqual(hintResult);
    await expect(client.getCodeAnalysisResult('1' as JobId<'ai:code-analysis'>)).resolves.toEqual(
      analysisResult,
    );
    await expect(
      client.getWeaknessAnalysisResult('1' as JobId<'ai:weakness-analysis'>),
    ).resolves.toEqual(weaknessResult);
  });

  it('GIVEN interview and session-report callbacks WHEN matching queue results arrive THEN client caches and forwards both payloads', async () => {
    const client = new QueueAiClient(queueService, cacheService);
    const interviewCallback = vi.fn(async () => {});
    const sessionReportCallback = vi.fn(async () => {});
    client.onInterviewResult(interviewCallback);
    client.onSessionReportResult(sessionReportCallback);

    await client.onModuleInit();

    const interviewResult = {
      jobId: 'interview-1',
      message: 'Walk me through your invariant.',
      followUpQuestion: 'How does this handle duplicates?',
      shouldSpeak: false,
      shouldEndInterview: false,
      rationale: 'Prompt for algorithm reasoning.',
    } as unknown as InterviewResponseResult & { jobId: string };
    const sessionReportResult = {
      jobId: 'report-1',
      sessionId: 'session-1',
      participantId: 'user-1',
    } as unknown as GenerateSessionReportResult & { jobId: string };

    await handlers.get(AI_INTERVIEW_RESULT_QUEUE)!({ data: interviewResult } as QueueJob<
      Record<string, unknown>
    >);
    await handlers.get(AI_SESSION_REPORT_RESULT_QUEUE)!({ data: sessionReportResult } as QueueJob<
      Record<string, unknown>
    >);

    expect(cacheService.set).toHaveBeenCalledWith(
      'ai-result:interview:interview-1',
      interviewResult,
      86_400,
    );
    expect(cacheService.set).toHaveBeenCalledWith(
      'ai-result:session-report:report-1',
      sessionReportResult,
      86_400,
    );
    expect(interviewCallback).toHaveBeenCalledWith('interview-1', interviewResult);
    expect(sessionReportCallback).toHaveBeenCalledWith('report-1', sessionReportResult);
  });

  it('GIVEN missing queue stats in healthCheck WHEN invoked THEN returns false instead of throwing', async () => {
    const queueWithHealth = {
      ...queueService,
      getQueueStats: vi.fn(async () => null),
    } as unknown as IQueueService;
    const client = new QueueAiClient(queueWithHealth, cacheService);

    await expect(client.healthCheck()).resolves.toBe(false);
  });

  it('GIVEN interview transcription request WHEN submitting and polling status THEN queue and cache namespaces are respected', async () => {
    const client = new QueueAiClient(queueService, cacheService);
    await client.onModuleInit();

    const request: InterviewTranscriptionRequest = {
      roomId: 'room-1',
      sessionId: 'session-1',
      participantId: 'user-1',
      audioBase64: 'ZmFrZS1hdWRpbw==',
      mimeType: 'audio/webm',
      language: 'en-US',
    };

    await client.submitInterviewTranscription(request);

    expect(queueService.enqueue).toHaveBeenCalledWith(
      AI_INTERVIEW_TRANSCRIPTION_QUEUE,
      'interview-transcription',
      request,
      expect.objectContaining({
        attempts: 3,
        backoff: { type: 'exponential', delay: 1500 },
      }),
    );

    const transcriptionResult: InterviewTranscriptionResult & { jobId: string } = {
      jobId: 'transcribe-1',
      text: 'Hello there',
    };
    await handlers.get(AI_INTERVIEW_TRANSCRIPTION_RESULT_QUEUE)!({
      data: transcriptionResult,
    } as QueueJob<Record<string, unknown>>);

    expect(cacheService.set).toHaveBeenCalledWith(
      'ai-result:interview-transcription:transcribe-1',
      transcriptionResult,
      86_400,
    );
    await expect(
      client.getInterviewTranscriptionResult('transcribe-1' as JobId<'ai:interview-transcription'>),
    ).resolves.toEqual(transcriptionResult);

    jobs.set(`${AI_INTERVIEW_TRANSCRIPTION_QUEUE}:transcribe-2`, {
      id: 'transcribe-2',
      name: 'interview-transcription',
      data: {},
      attemptsMade: 0,
      maxAttempts: 3,
      timestamp: Date.now(),
      processedOn: Date.now(),
    });

    await expect(
      client.getInterviewTranscriptionJobStatus(
        'transcribe-2' as JobId<'ai:interview-transcription'>,
      ),
    ).resolves.toBe('running');
  });
});
