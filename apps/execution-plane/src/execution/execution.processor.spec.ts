import { Test } from '@nestjs/testing';
import { EXECUTION_QUEUE, EXECUTION_RESULT_QUEUE, type RunCodeRequest } from '@syncode/contracts';
import type { SupportedLanguage } from '@syncode/shared';
import type { ExecutionResult, QueueJob } from '@syncode/shared/ports';
import { QUEUE_SERVICE, SANDBOX_PROVIDER } from '@syncode/shared/ports';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { ExecutionProcessor } from './execution.processor.js';

function makeJob(
  overrides: Partial<QueueJob<RunCodeRequest>> & { data: RunCodeRequest },
): QueueJob<RunCodeRequest> {
  return {
    id: 'job-1',
    name: 'run-code',
    attemptsMade: 0,
    maxAttempts: 3,
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeExecutionResult(overrides: Partial<ExecutionResult> = {}): ExecutionResult {
  return {
    status: 'success',
    stdout: 'hello',
    stderr: '',
    exitCode: 0,
    durationMs: 150,
    timedOut: false,
    error: undefined,
    cpuTimeMs: 100,
    memoryUsageMb: 32,
    outputTruncated: false,
    ...overrides,
  };
}

describe('ExecutionProcessor', () => {
  let processor: ExecutionProcessor;
  let queueService: Record<string, Mock>;
  let sandbox: Record<string, Mock>;
  let capturedHandler: (job: QueueJob<RunCodeRequest>) => Promise<void>;

  beforeEach(async () => {
    queueService = {
      process: vi.fn().mockImplementation((_queue, handler) => {
        capturedHandler = handler;
      }),
      enqueue: vi.fn().mockResolvedValue('enqueued-id'),
    };

    sandbox = {
      execute: vi.fn().mockResolvedValue(makeExecutionResult()),
      supportsLanguage: vi.fn().mockReturnValue(true),
      healthCheck: vi.fn().mockResolvedValue(true),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        ExecutionProcessor,
        { provide: QUEUE_SERVICE, useValue: queueService },
        { provide: SANDBOX_PROVIDER, useValue: sandbox },
      ],
    }).compile();

    processor = module.get(ExecutionProcessor);
    processor.onModuleInit();
  });

  it('should register a processor on EXECUTION_QUEUE during onModuleInit', () => {
    expect(queueService.process).toHaveBeenCalledWith(
      EXECUTION_QUEUE,
      expect.any(Function),
      expect.objectContaining({ concurrency: 5 }),
    );
  });

  describe('GIVEN a valid python request', () => {
    it('WHEN job is processed THEN sandbox.execute is called with clamped defaults and result is enqueued', async () => {
      const job = makeJob({
        id: 'job-42',
        data: { language: 'python', code: 'print("hi")' },
      });

      await capturedHandler(job);

      expect(sandbox.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'job-42',
          userId: 'system',
          language: 'python',
          code: 'print("hi")',
          timeoutMs: 30_000,
          memoryMb: 128,
        }),
      );

      expect(queueService.enqueue).toHaveBeenCalledWith(
        EXECUTION_RESULT_QUEUE,
        'execution-result',
        expect.objectContaining({
          status: 'success',
          stdout: 'hello',
          stderr: '',
          exitCode: 0,
          jobId: 'job-42',
        }),
      );
    });
  });

  describe('GIVEN a request with custom timeout exceeding max', () => {
    it('WHEN job is processed THEN timeout is clamped to 300000', async () => {
      const job = makeJob({
        data: {
          language: 'python',
          code: 'x = 1',
          timeoutMs: 999_999,
        },
      });

      await capturedHandler(job);

      expect(sandbox.execute).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 300_000 }));
    });
  });

  describe('GIVEN a request with custom memory exceeding max', () => {
    it('WHEN job is processed THEN memory is clamped to 1024', async () => {
      const job = makeJob({
        data: {
          language: 'python',
          code: 'x = 1',
          memoryMb: 8192,
        },
      });

      await capturedHandler(job);

      expect(sandbox.execute).toHaveBeenCalledWith(expect.objectContaining({ memoryMb: 1024 }));
    });
  });

  describe('GIVEN an unsupported language', () => {
    it('WHEN job is processed THEN enqueues failed result WITHOUT calling sandbox.execute', async () => {
      const job = makeJob({
        id: 'job-bad-lang',
        data: {
          language: 'brainfuck' as SupportedLanguage,
          code: '+++.',
        },
      });

      await capturedHandler(job);

      expect(sandbox.execute).not.toHaveBeenCalled();
      expect(queueService.enqueue).toHaveBeenCalledWith(
        EXECUTION_RESULT_QUEUE,
        'execution-result',
        expect.objectContaining({
          status: 'failed',
          error: 'Unsupported language: brainfuck',
          jobId: 'job-bad-lang',
        }),
      );
    });
  });

  describe('GIVEN language supported globally but not by sandbox', () => {
    it('WHEN job is processed THEN enqueues failed result', async () => {
      sandbox.supportsLanguage.mockReturnValue(false);

      const job = makeJob({
        id: 'job-no-sandbox',
        data: { language: 'rust', code: 'fn main() {}' },
      });

      await capturedHandler(job);

      expect(sandbox.execute).not.toHaveBeenCalled();
      expect(queueService.enqueue).toHaveBeenCalledWith(
        EXECUTION_RESULT_QUEUE,
        'execution-result',
        expect.objectContaining({
          status: 'failed',
          error: 'Sandbox does not support language: rust',
          jobId: 'job-no-sandbox',
        }),
      );
    });
  });

  describe('GIVEN empty code', () => {
    it('WHEN job is processed THEN enqueues failed result', async () => {
      const job = makeJob({
        id: 'job-empty',
        data: { language: 'python', code: '' },
      });

      await capturedHandler(job);

      expect(sandbox.execute).not.toHaveBeenCalled();
      expect(queueService.enqueue).toHaveBeenCalledWith(
        EXECUTION_RESULT_QUEUE,
        'execution-result',
        expect.objectContaining({
          status: 'failed',
          error: 'Code cannot be empty',
          jobId: 'job-empty',
        }),
      );
    });
  });

  describe('GIVEN whitespace-only code', () => {
    it('WHEN job is processed THEN enqueues failed result', async () => {
      const job = makeJob({
        id: 'job-ws',
        data: { language: 'python', code: '   \n\t  ' },
      });

      await capturedHandler(job);

      expect(sandbox.execute).not.toHaveBeenCalled();
      expect(queueService.enqueue).toHaveBeenCalledWith(
        EXECUTION_RESULT_QUEUE,
        'execution-result',
        expect.objectContaining({
          status: 'failed',
          error: 'Code cannot be empty',
          jobId: 'job-ws',
        }),
      );
    });
  });

  describe('GIVEN sandbox.execute throws', () => {
    it('WHEN job is processed THEN error propagates (not caught)', async () => {
      sandbox.execute.mockRejectedValue(new Error('Sandbox crashed'));

      const job = makeJob({
        data: { language: 'python', code: 'x = 1' },
      });

      await expect(capturedHandler(job)).rejects.toThrow('Sandbox crashed');
      expect(queueService.enqueue).not.toHaveBeenCalled();
    });
  });
});
