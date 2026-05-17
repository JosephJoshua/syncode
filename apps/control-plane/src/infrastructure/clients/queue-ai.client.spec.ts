import {
  AI_CODE_ANALYSIS_RESULT_QUEUE,
  AI_HINT_RESULT_QUEUE,
  AI_WEAKNESS_ANALYSIS_RESULT_QUEUE,
  type AnalyzeCodeResult,
  type GenerateHintResult,
  type GenerateWeaknessAnalysisResult,
  type JobId,
} from '@syncode/contracts';
import type { ICacheService, IQueueService, QueueJob } from '@syncode/shared/ports';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueueAiClient } from './queue-ai.client';

describe('QueueAiClient', () => {
  const handlers = new Map<string, (job: QueueJob<Record<string, unknown>>) => Promise<void>>();
  const cacheEntries = new Map<string, unknown>();
  const queueService = {
    process: vi.fn(
      (queue: string, handler: (job: QueueJob<Record<string, unknown>>) => Promise<void>) => {
        handlers.set(queue, handler);
      },
    ),
  } as unknown as IQueueService;
  const cacheService = {
    set: vi.fn(async (key: string, value: unknown) => {
      cacheEntries.set(key, value);
    }),
    get: vi.fn(async <T>(key: string) => (cacheEntries.get(key) as T | undefined) ?? null),
  } as unknown as ICacheService;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers.clear();
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
});
