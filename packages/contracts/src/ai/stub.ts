import { randomUUID } from 'node:crypto';
import type { JobId, JobStatus, SubmitResult } from '../queues';
import type { IAiClient } from './client';
import type {
  GenerateHintRequest,
  GenerateHintResult,
  InterviewResponseRequest,
  InterviewResponseResult,
  ReviewCodeRequest,
  ReviewCodeResult,
} from './types';

type AiJobType = 'hint' | 'review' | 'interview';

interface StubJob {
  status: JobStatus;
  type: AiJobType;
  hintResult?: GenerateHintResult;
  reviewResult?: ReviewCodeResult;
  interviewResult?: InterviewResponseResult;
}

interface StubAiClientOptions {
  /** Delay in ms before job completes (default: 800) */
  delayMs?: number;
}

const HINT_RESPONSES = {
  gentle: 'Consider what data structure would let you look up values efficiently.',
  moderate:
    'A hash map would give you O(1) lookups. Think about what you need to store as keys vs values.',
  direct:
    'Use a hash map to store each number and its index. For each element, check if the complement (target - current) exists in the map.',
} satisfies Record<string, string>;

export class StubAiClient implements IAiClient {
  private readonly jobs = new Map<string, StubJob>();
  private readonly timers: ReturnType<typeof setTimeout>[] = [];
  private readonly delayMs: number;

  constructor(options: StubAiClientOptions = {}) {
    this.delayMs = options.delayMs ?? 800;
  }

  /** Clear all pending timers. Call from OnModuleDestroy or test teardown. */
  shutdown(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers.length = 0;
  }

  async submitHintRequest(request: GenerateHintRequest): Promise<SubmitResult<'ai:hint'>> {
    const jobId = randomUUID() as JobId<'ai:hint'>;
    this.jobs.set(jobId, { status: 'queued', type: 'hint' });

    this.scheduleHintCompletion(jobId, request);
    return { jobId };
  }

  async getHintResult(jobId: JobId<'ai:hint'>): Promise<GenerateHintResult | null> {
    const job = this.jobs.get(jobId);
    if (!job || job.type !== 'hint') return null;
    return job.hintResult ?? null;
  }

  async submitReviewRequest(_request: ReviewCodeRequest): Promise<SubmitResult<'ai:review'>> {
    const jobId = randomUUID() as JobId<'ai:review'>;
    this.jobs.set(jobId, { status: 'queued', type: 'review' });

    this.scheduleReviewCompletion(jobId);
    return { jobId };
  }

  async getReviewResult(jobId: JobId<'ai:review'>): Promise<ReviewCodeResult | null> {
    const job = this.jobs.get(jobId);
    if (!job || job.type !== 'review') return null;
    return job.reviewResult ?? null;
  }

  async submitInterviewResponse(
    _request: InterviewResponseRequest,
  ): Promise<SubmitResult<'ai:interview'>> {
    const jobId = randomUUID() as JobId<'ai:interview'>;
    this.jobs.set(jobId, { status: 'queued', type: 'interview' });

    this.scheduleInterviewCompletion(jobId);
    return { jobId };
  }

  async getInterviewResult(jobId: JobId<'ai:interview'>): Promise<InterviewResponseResult | null> {
    const job = this.jobs.get(jobId);
    if (!job || job.type !== 'interview') return null;
    return job.interviewResult ?? null;
  }

  async getHintJobStatus(jobId: JobId<'ai:hint'>): Promise<JobStatus> {
    const job = this.jobs.get(jobId);
    if (!job || job.type !== 'hint') return 'failed';
    return job.status;
  }

  async getReviewJobStatus(jobId: JobId<'ai:review'>): Promise<JobStatus> {
    const job = this.jobs.get(jobId);
    if (!job || job.type !== 'review') return 'failed';
    return job.status;
  }

  async getInterviewJobStatus(jobId: JobId<'ai:interview'>): Promise<JobStatus> {
    const job = this.jobs.get(jobId);
    if (!job || job.type !== 'interview') return 'failed';
    return job.status;
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  private scheduleHintCompletion(jobId: string, request: GenerateHintRequest): void {
    this.timers.push(
      setTimeout(() => {
        const job = this.jobs.get(jobId);
        if (job) job.status = 'running';
      }, this.delayMs / 4),
    );

    this.timers.push(
      setTimeout(() => {
        const job = this.jobs.get(jobId);
        if (!job) return;

        job.status = 'completed';
        job.hintResult = {
          hint: HINT_RESPONSES[request.hintLevel] ?? HINT_RESPONSES.gentle,
          suggestedApproach: 'Consider breaking the problem into smaller subproblems.',
        };
      }, this.delayMs),
    );
  }

  private scheduleReviewCompletion(jobId: string): void {
    this.timers.push(
      setTimeout(() => {
        const job = this.jobs.get(jobId);
        if (job) job.status = 'running';
      }, this.delayMs / 4),
    );

    this.timers.push(
      setTimeout(() => {
        const job = this.jobs.get(jobId);
        if (!job) return;

        job.status = 'completed';
        job.reviewResult = {
          overallScore: 7,
          categories: [
            {
              name: 'Correctness',
              score: 8,
              feedback: 'Solution handles main cases correctly.',
            },
            {
              name: 'Efficiency',
              score: 7,
              feedback: 'Time complexity is acceptable. Consider edge cases.',
            },
            {
              name: 'Code Quality',
              score: 6,
              feedback: 'Variable naming could be more descriptive.',
            },
          ],
          summary:
            'Solid solution with room for improvement in code clarity and edge case handling.',
        };
      }, this.delayMs),
    );
  }

  private scheduleInterviewCompletion(jobId: string): void {
    this.timers.push(
      setTimeout(() => {
        const job = this.jobs.get(jobId);
        if (job) job.status = 'running';
      }, this.delayMs / 4),
    );

    this.timers.push(
      setTimeout(() => {
        const job = this.jobs.get(jobId);
        if (!job) return;

        job.status = 'completed';
        job.interviewResult = {
          message: "That's a good approach. Let me ask you about the time complexity.",
          followUpQuestion: 'What is the time and space complexity of your solution?',
          codeAnnotations: [
            {
              line: 1,
              comment: 'Consider adding input validation here.',
            },
          ],
        };
      }, this.delayMs),
    );
  }
}
