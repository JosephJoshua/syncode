import { Test } from '@nestjs/testing';
import {
  STATIC_ANALYSIS_QUEUE,
  STATIC_ANALYSIS_RESULT_QUEUE,
  type StaticAnalysisRequest,
  type StaticAnalysisResult,
} from '@syncode/contracts';
import type { QueueJob } from '@syncode/shared/ports';
import { QUEUE_SERVICE } from '@syncode/shared/ports';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { StaticAnalysisProcessor } from './static-analysis.processor.js';
import { StaticAnalysisAnalyzer } from './static-analysis-analyzer.service.js';

function makeJob(data: StaticAnalysisRequest): QueueJob<StaticAnalysisRequest> {
  return {
    id: 'analysis-job-1',
    name: 'static-analysis',
    data,
    attemptsMade: 0,
    maxAttempts: 3,
    timestamp: Date.now(),
  };
}

function makeRequest(overrides: Partial<StaticAnalysisRequest> = {}): StaticAnalysisRequest {
  return {
    userId: '550e8400-e29b-41d4-a716-446655440000',
    roomId: '660e8400-e29b-41d4-a716-446655440000',
    runId: '770e8400-e29b-41d4-a716-446655440000',
    language: 'python',
    source: 'run',
    code: 'def solve(x):\n    return x\n',
    ...overrides,
  };
}

describe('StaticAnalysisProcessor', () => {
  let queueService: Record<string, Mock>;
  let analyzer: { analyze: Mock };
  let capturedHandler: (job: QueueJob<StaticAnalysisRequest>) => Promise<void>;

  beforeEach(async () => {
    queueService = {
      process: vi.fn().mockImplementation((_queue, handler) => {
        capturedHandler = handler;
      }),
      enqueue: vi.fn().mockResolvedValue('result-job-id'),
    };
    analyzer = {
      analyze: vi.fn().mockResolvedValue({
        status: 'completed',
        summary: {
          diagnosticCount: 0,
          errorCount: 0,
          warningCount: 0,
          maxCyclomaticComplexity: 1,
          highComplexityCount: 0,
          duplicationCount: 0,
          toolFailureCount: 0,
        },
        diagnostics: [],
        complexity: [],
        duplications: [],
        toolResults: [],
      } satisfies Omit<StaticAnalysisResult, 'jobId'>),
    };

    const module = await Test.createTestingModule({
      providers: [
        StaticAnalysisProcessor,
        { provide: StaticAnalysisAnalyzer, useValue: analyzer },
        { provide: QUEUE_SERVICE, useValue: queueService },
      ],
    }).compile();

    module.get(StaticAnalysisProcessor).onModuleInit();
  });

  it('GIVEN processor init WHEN called THEN registers static-analysis queue with bounded concurrency', () => {
    expect(queueService.process).toHaveBeenCalledWith(
      STATIC_ANALYSIS_QUEUE,
      expect.any(Function),
      expect.objectContaining({ concurrency: 2 }),
    );
  });

  it('GIVEN valid job WHEN processed THEN enqueues structured result with original metadata', async () => {
    await capturedHandler(makeJob(makeRequest()));

    expect(queueService.enqueue).toHaveBeenCalledWith(
      STATIC_ANALYSIS_RESULT_QUEUE,
      'static-analysis-result',
      expect.objectContaining({
        jobId: 'analysis-job-1',
        status: 'completed',
        summary: expect.objectContaining({ maxCyclomaticComplexity: 1 }),
      }),
      expect.objectContaining({ removeOnComplete: 100 }),
    );
  });

  it('GIVEN analyzer throws WHEN processed THEN returns failed result instead of retrying forever', async () => {
    analyzer.analyze.mockRejectedValue(new Error('toolchain unavailable'));

    await capturedHandler(makeJob(makeRequest()));

    expect(queueService.enqueue).toHaveBeenCalledWith(
      STATIC_ANALYSIS_RESULT_QUEUE,
      'static-analysis-result',
      expect.objectContaining({
        jobId: 'analysis-job-1',
        status: 'failed',
        error: 'toolchain unavailable',
      }),
      expect.any(Object),
    );
  });
});
