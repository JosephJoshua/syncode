import { randomUUID } from 'node:crypto';
import type { JobId, JobStatus, SubmitResult } from '../queues.js';
import type { IExecutionClient } from './client.js';
import type { RunCodeRequest, RunCodeResult } from './types.js';

interface StubJob {
  status: JobStatus;
  result?: RunCodeResult;
}

interface StubExecutionClientOptions {
  /** Delay in ms before job completes (default: 800) */
  delayMs?: number;
  /** Probability of failure between 0 and 1 (default: 0) */
  failRate?: number;
}

const LANGUAGE_OUTPUTS: Record<string, string> = {
  python: 'Hello, World!\n',
  javascript: 'Hello, World!\n',
  typescript: 'Hello, World!\n',
  java: 'Hello, World!\n',
  cpp: 'Hello, World!\n',
  c: 'Hello, World!\n',
  go: 'Hello, World!\n',
  rust: 'Hello, World!\n',
};

export class StubExecutionClient implements IExecutionClient {
  private readonly jobs = new Map<string, StubJob>();
  private readonly delayMs: number;
  private readonly failRate: number;

  constructor(options: StubExecutionClientOptions = {}) {
    this.delayMs = options.delayMs ?? 800;
    this.failRate = options.failRate ?? 0;
  }

  async submit(request: RunCodeRequest): Promise<SubmitResult<'execution'>> {
    const jobId = randomUUID() as JobId<'execution'>;
    this.jobs.set(jobId, { status: 'queued' });

    this.scheduleCompletion(jobId, request);
    return { jobId };
  }

  async getResult(jobId: JobId<'execution'>): Promise<RunCodeResult | null> {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    return job.result ?? null;
  }

  async getJobStatus(jobId: JobId): Promise<JobStatus> {
    const job = this.jobs.get(jobId);
    if (!job) return 'failed';
    return job.status;
  }

  async cancel(jobId: JobId): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job) job.status = 'failed';
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  private scheduleCompletion(jobId: string, request: RunCodeRequest): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    // queued -> running
    setTimeout(() => {
      const current = this.jobs.get(jobId);
      if (current) current.status = 'running';
    }, this.delayMs / 4);

    // running -> completed/failed
    setTimeout(() => {
      const current = this.jobs.get(jobId);
      if (!current) return;

      const shouldFail = Math.random() < this.failRate;

      if (shouldFail) {
        current.status = 'failed';
        current.result = {
          status: 'failed',
          stdout: '',
          stderr: 'Stub: simulated execution failure',
          exitCode: 1,
          durationMs: this.delayMs,
          timedOut: false,
          error: 'Simulated failure (stub failRate)',
        };
      } else {
        current.status = 'completed';
        current.result = {
          status: 'completed',
          stdout: LANGUAGE_OUTPUTS[request.language] ?? `[${request.language}] OK\n`,
          stderr: '',
          exitCode: 0,
          durationMs: this.delayMs,
          timedOut: false,
        };
      }
    }, this.delayMs);
  }
}
