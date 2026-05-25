import {
  EXECUTION_QUEUE,
  EXECUTION_RESULT_QUEUE,
  type JobId,
  type RunCodeRequest,
  type RunCodeResult,
  STATIC_ANALYSIS_QUEUE,
  STATIC_ANALYSIS_RESULT_QUEUE,
  type StaticAnalysisRequest,
  type StaticAnalysisResult,
} from '@syncode/contracts';
import type { ICacheService, IQueueService, QueueJob, QueueStats } from '@syncode/shared/ports';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueueExecutionClient } from './queue-execution.client.js';

describe('QueueExecutionClient', () => {
  const handlers = new Map<string, (job: QueueJob<Record<string, unknown>>) => Promise<void>>();
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
    cacheEntries.clear();
  });

  it('GIVEN execution and static-analysis result queues WHEN results arrive THEN both namespaces are cached', async () => {
    const client = new QueueExecutionClient(queueService, cacheService);
    await client.onModuleInit();

    const executionResult: RunCodeResult & { jobId: string } = {
      jobId: 'exec-1',
      status: 'completed',
      stdout: 'ok',
      stderr: '',
      exitCode: 0,
      durationMs: 10,
      timedOut: false,
    };
    const staticAnalysisResult: StaticAnalysisResult = {
      jobId: 'static-1',
      userId: 'user-1',
      roomId: 'room-1',
      sessionId: 'session-1',
      runId: 'run-1',
      submissionId: null,
      language: 'python',
      source: 'run',
      code: 'print(1)',
      timeoutMs: 20_000,
      status: 'completed',
      diagnostics: [],
      complexity: [],
      duplications: [],
      toolResults: [],
      summary: {
        diagnosticCount: 0,
        errorCount: 0,
        warningCount: 0,
        maxCyclomaticComplexity: null,
        highComplexityCount: 0,
        duplicationCount: 0,
        toolFailureCount: 0,
      },
    };

    await handlers.get(EXECUTION_RESULT_QUEUE)!({ data: executionResult } as QueueJob<
      Record<string, unknown>
    >);
    await handlers.get(STATIC_ANALYSIS_RESULT_QUEUE)!({ data: staticAnalysisResult } as QueueJob<
      Record<string, unknown>
    >);

    expect(cacheService.set).toHaveBeenCalledWith('exec-result:exec-1', executionResult, 86_400);
    expect(cacheService.set).toHaveBeenCalledWith(
      'exec-static-analysis-result:static-1',
      staticAnalysisResult,
      86_400,
    );
    await expect(client.getResult('exec-1' as JobId<'execution'>)).resolves.toEqual(
      executionResult,
    );
    await expect(
      client.getStaticAnalysisResult('static-1' as JobId<'static-analysis'>),
    ).resolves.toEqual(staticAnalysisResult);
  });

  it('GIVEN static-analysis request with idempotency key WHEN submitting THEN enqueue includes the key and queue name', async () => {
    const client = new QueueExecutionClient(queueService, cacheService);
    const request: StaticAnalysisRequest = {
      userId: 'user-1',
      roomId: 'room-1',
      sessionId: 'session-1',
      runId: 'run-1',
      submissionId: null,
      language: 'python',
      source: 'run',
      code: 'print(1)',
      timeoutMs: 20_000,
    };

    await client.submitStaticAnalysis(request, { idempotencyKey: 'idem-1' });

    expect(queueService.enqueue).toHaveBeenCalledWith(
      STATIC_ANALYSIS_QUEUE,
      'static-analysis',
      request,
      expect.objectContaining({ idempotencyKey: 'idem-1' }),
    );
  });

  it('GIVEN queue stats lookup fails WHEN running healthCheck THEN returns false', async () => {
    const unhealthyQueueService = {
      ...queueService,
      getQueueStats: vi.fn(async () => {
        throw new Error('queue down');
      }),
    } as unknown as IQueueService;
    const client = new QueueExecutionClient(unhealthyQueueService, cacheService);

    await expect(client.healthCheck()).resolves.toBe(false);
  });

  it('GIVEN run-code request WHEN submitting THEN enqueues on execution queue with retries', async () => {
    const client = new QueueExecutionClient(queueService, cacheService);
    const request: RunCodeRequest = {
      language: 'python',
      code: 'print(1)',
    };

    await client.submit(request);

    expect(queueService.enqueue).toHaveBeenCalledWith(
      EXECUTION_QUEUE,
      'run-code',
      request,
      expect.objectContaining({
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      }),
    );
  });
});
