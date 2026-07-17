import { Logger } from '@nestjs/common';
import type { ICacheService, IQueueService, QueueJob } from '@syncode/shared/ports';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { QueueClientHelper, RESULT_TTL_SECONDS } from './queue-client.helpers';

type QueueResultData = Record<string, unknown>;

function toQueueJob(data: QueueResultData): QueueJob<QueueResultData> {
  return { data } as QueueJob<QueueResultData>;
}

describe('QueueClientHelper', () => {
  let helper: QueueClientHelper;
  const process = vi.fn();
  const getJob = vi.fn();
  const get = vi.fn();
  const set = vi.fn();
  const exists = vi.fn();

  beforeAll(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    helper = new QueueClientHelper(
      { process, getJob } as unknown as IQueueService,
      { get, set, exists } as unknown as ICacheService,
      new Logger('test'),
      'exec:result:',
    );
  });

  describe('processResultQueue', () => {
    let handler: (job: QueueJob<QueueResultData>) => Promise<void>;

    beforeEach(() => {
      helper.processResultQueue('results-queue', 'execution');
      handler = process.mock.calls[0][1] as (job: QueueJob<QueueResultData>) => Promise<void>;
    });

    test('GIVEN result queue WHEN registering processor THEN caches results with correct key', async () => {
      const processCall = process.mock.calls[0];
      expect(processCall[0]).toBe('results-queue');
      expect(processCall[2]).toEqual({ concurrency: 10 });

      await handler(toQueueJob({ jobId: 'job-1', stdout: 'hello' }));

      expect(set).toHaveBeenCalledWith(
        'exec:result:job-1',
        { jobId: 'job-1', stdout: 'hello' },
        RESULT_TTL_SECONDS,
      );
    });

    test('GIVEN result namespace WHEN registering processor THEN caches results under namespaced key', async () => {
      helper.processResultQueue('other-results-queue', 'ai-code-analysis', 'code-analysis');
      const namespacedHandler = process.mock.calls[1][1] as (
        job: QueueJob<QueueResultData>,
      ) => Promise<void>;

      await namespacedHandler(toQueueJob({ jobId: 'job-1', summary: 'analysis' }));

      expect(set).toHaveBeenCalledWith(
        'exec:result:code-analysis:job-1',
        { jobId: 'job-1', summary: 'analysis' },
        RESULT_TTL_SECONDS,
      );
    });

    test('GIVEN result without jobId WHEN processor invoked THEN skips caching', async () => {
      await handler(toQueueJob({}));

      expect(set).not.toHaveBeenCalled();
    });

    test('GIVEN callback registered WHEN result arrives THEN callback is invoked with jobId and data', async () => {
      const callback = vi.fn().mockResolvedValue(undefined);
      helper.setResultCallback(callback);

      await handler(toQueueJob({ jobId: 'job-2', stdout: 'world' }));

      expect(callback).toHaveBeenCalledWith('job-2', {
        jobId: 'job-2',
        stdout: 'world',
      });
    });

    test('GIVEN callback throws WHEN result arrives THEN result is still cached', async () => {
      const callback = vi.fn().mockRejectedValue(new Error('boom'));
      helper.setResultCallback(callback);

      await handler(toQueueJob({ jobId: 'job-3', stdout: 'ok' }));

      expect(set).toHaveBeenCalledWith(
        'exec:result:job-3',
        { jobId: 'job-3', stdout: 'ok' },
        RESULT_TTL_SECONDS,
      );
    });
  });

  describe('getResult', () => {
    test('GIVEN cached result WHEN looking up THEN returns it', async () => {
      get.mockResolvedValue({ stdout: 'hello' });

      const result = await helper.getResult('job-1');

      expect(result).toEqual({ stdout: 'hello' });
      expect(get).toHaveBeenCalledWith('exec:result:job-1');
    });

    test('GIVEN namespace WHEN looking up cached result THEN uses namespaced key', async () => {
      get.mockResolvedValue({ summary: 'analysis' });

      const result = await helper.getResult('job-1', 'code-analysis');

      expect(result).toEqual({ summary: 'analysis' });
      expect(get).toHaveBeenCalledWith('exec:result:code-analysis:job-1');
    });

    test('GIVEN no cached result WHEN looking up THEN returns null', async () => {
      get.mockResolvedValue(null);

      const result = await helper.getResult('job-1');

      expect(result).toBeNull();
    });
  });

  describe('getJobStatus', () => {
    test('GIVEN result is cached WHEN checking status THEN returns completed', async () => {
      exists.mockResolvedValue(true);

      const status = await helper.getJobStatus('run-queue', 'job-1');

      expect(status).toBe('completed');
      expect(getJob).not.toHaveBeenCalled();
    });

    test('GIVEN namespace WHEN checking status THEN checks namespaced cache key', async () => {
      exists.mockResolvedValue(true);

      const status = await helper.getJobStatus('run-queue', 'job-1', 'code-analysis');

      expect(status).toBe('completed');
      expect(exists).toHaveBeenCalledWith('exec:result:code-analysis:job-1');
      expect(getJob).not.toHaveBeenCalled();
    });

    test('GIVEN no cache and no job in queue WHEN checking status THEN returns failed', async () => {
      exists.mockResolvedValue(false);
      getJob.mockResolvedValue(null);

      const status = await helper.getJobStatus('run-queue', 'job-1');

      expect(status).toBe('failed');
    });

    test('GIVEN job finished with failedReason WHEN checking status THEN returns failed', async () => {
      exists.mockResolvedValue(false);
      getJob.mockResolvedValue({ id: 'job-1', finishedOn: Date.now(), failedReason: 'timeout' });

      const status = await helper.getJobStatus('run-queue', 'job-1');

      expect(status).toBe('failed');
    });

    test('GIVEN job finished without failedReason WHEN checking status THEN returns completed', async () => {
      exists.mockResolvedValue(false);
      getJob.mockResolvedValue({ id: 'job-1', finishedOn: Date.now() });

      const status = await helper.getJobStatus('run-queue', 'job-1');

      expect(status).toBe('completed');
    });

    test('GIVEN job is being processed WHEN checking status THEN returns running', async () => {
      exists.mockResolvedValue(false);
      getJob.mockResolvedValue({ id: 'job-1', processedOn: Date.now() });

      const status = await helper.getJobStatus('run-queue', 'job-1');

      expect(status).toBe('running');
    });

    test('GIVEN job exists but not yet processed WHEN checking status THEN returns queued', async () => {
      exists.mockResolvedValue(false);
      getJob.mockResolvedValue({ id: 'job-1' });

      const status = await helper.getJobStatus('run-queue', 'job-1');

      expect(status).toBe('queued');
    });
  });
});
