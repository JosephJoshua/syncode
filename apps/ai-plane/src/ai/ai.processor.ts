import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AI_CODE_ANALYSIS_QUEUE,
  AI_CODE_ANALYSIS_RESULT_QUEUE,
  AI_HINT_QUEUE,
  AI_HINT_RESULT_QUEUE,
  AI_INTERVIEW_QUEUE,
  AI_INTERVIEW_RESULT_QUEUE,
  AI_INTERVIEW_TRANSCRIPTION_QUEUE,
  AI_INTERVIEW_TRANSCRIPTION_RESULT_QUEUE,
  AI_REVIEW_QUEUE,
  AI_REVIEW_RESULT_QUEUE,
  AI_SESSION_REPORT_QUEUE,
  AI_SESSION_REPORT_RESULT_QUEUE,
  AI_WEAKNESS_ANALYSIS_QUEUE,
  AI_WEAKNESS_ANALYSIS_RESULT_QUEUE,
  type AnalyzeCodeRequest,
  type GenerateHintRequest,
  type GenerateSessionReportRequest,
  type GenerateWeaknessAnalysisRequest,
  type InterviewResponseRequest,
  type InterviewTranscriptionRequest,
  type ReviewCodeRequest,
} from '@syncode/contracts';
import type { IQueueService, QueueJob } from '@syncode/shared/ports';
import { QUEUE_SERVICE } from '@syncode/shared/ports';
import type { EnvConfig } from '../config/env.config.js';
import { AiService } from './ai.service.js';

const RESULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1500 },
  removeOnComplete: 100,
  removeOnFail: false,
} as const;

const DEFAULT_MAX_CONCURRENT_AI_JOBS = 5;
const DEFAULT_RESERVED_REALTIME_SLOTS = 2;

type AiTaskClass = 'realtime' | 'batch';

interface PendingAiJob {
  queueName: string;
  jobId: string;
  taskClass: AiTaskClass;
  priority: number;
  queuedAtMs: number;
  grant: () => void;
}

const REALTIME_QUEUE_NAMES = new Set<string>([
  AI_HINT_QUEUE,
  AI_CODE_ANALYSIS_QUEUE,
  AI_REVIEW_QUEUE,
  AI_INTERVIEW_QUEUE,
  AI_INTERVIEW_TRANSCRIPTION_QUEUE,
]);
const BATCH_QUEUE_NAMES = new Set<string>([AI_WEAKNESS_ANALYSIS_QUEUE, AI_SESSION_REPORT_QUEUE]);

const AI_JOB_PRIORITY: Record<AiTaskClass, number> = {
  realtime: 2,
  batch: 1,
};

@Injectable()
export class AiProcessor implements OnModuleInit {
  private readonly logger = new Logger(AiProcessor.name);
  private readonly maxConcurrentAiJobs: number;
  private readonly maxConcurrentBatchAiJobs: number;
  private readonly reservedRealtimeSlots: number;
  private activeAiJobs = 0;
  private activeRealtimeAiJobs = 0;
  private activeBatchAiJobs = 0;
  private readonly pendingAiJobs: PendingAiJob[] = [];

  constructor(
    @Inject(QUEUE_SERVICE) private readonly queueService: IQueueService,
    private readonly aiService: AiService,
    @Optional() configService?: ConfigService<EnvConfig>,
  ) {
    this.maxConcurrentAiJobs = this.resolveMaxConcurrentAiJobs(configService);
    this.reservedRealtimeSlots = this.resolveReservedRealtimeSlots(
      configService,
      this.maxConcurrentAiJobs,
    );
    this.maxConcurrentBatchAiJobs = this.resolveMaxConcurrentBatchAiJobs(
      configService,
      this.maxConcurrentAiJobs,
    );
  }

  onModuleInit() {
    this.logger.log(
      `AI concurrency config: maxTotal=${this.maxConcurrentAiJobs}, maxBatch=${this.maxConcurrentBatchAiJobs}, reservedRealtimeSlots=${this.reservedRealtimeSlots}`,
    );

    this.queueService.process<GenerateHintRequest>(
      AI_HINT_QUEUE,
      async (job: QueueJob<GenerateHintRequest>) => {
        await this.runWithConcurrencyLimit(AI_HINT_QUEUE, job.id, async () => {
          await this.handleHintJob(job);
        });
      },
      { concurrency: 5 },
    );
    this.logger.log(`Registered processor on ${AI_HINT_QUEUE}`);

    this.queueService.process<AnalyzeCodeRequest>(
      AI_CODE_ANALYSIS_QUEUE,
      async (job: QueueJob<AnalyzeCodeRequest>) => {
        await this.runWithConcurrencyLimit(AI_CODE_ANALYSIS_QUEUE, job.id, async () => {
          await this.handleCodeAnalysisJob(job);
        });
      },
      { concurrency: 3 },
    );
    this.logger.log(`Registered processor on ${AI_CODE_ANALYSIS_QUEUE}`);

    this.queueService.process<GenerateWeaknessAnalysisRequest>(
      AI_WEAKNESS_ANALYSIS_QUEUE,
      async (job: QueueJob<GenerateWeaknessAnalysisRequest>) => {
        await this.runWithConcurrencyLimit(AI_WEAKNESS_ANALYSIS_QUEUE, job.id, async () => {
          await this.handleWeaknessAnalysisJob(job);
        });
      },
      { concurrency: 2 },
    );
    this.logger.log(`Registered processor on ${AI_WEAKNESS_ANALYSIS_QUEUE}`);

    this.queueService.process<ReviewCodeRequest>(
      AI_REVIEW_QUEUE,
      async (job: QueueJob<ReviewCodeRequest>) => {
        await this.runWithConcurrencyLimit(AI_REVIEW_QUEUE, job.id, async () => {
          await this.handleReviewJob(job);
        });
      },
      { concurrency: 3 },
    );
    this.logger.log(`Registered processor on ${AI_REVIEW_QUEUE}`);

    this.queueService.process<InterviewResponseRequest>(
      AI_INTERVIEW_QUEUE,
      async (job: QueueJob<InterviewResponseRequest>) => {
        await this.runWithConcurrencyLimit(AI_INTERVIEW_QUEUE, job.id, async () => {
          await this.handleInterviewJob(job);
        });
      },
      { concurrency: 3 },
    );
    this.logger.log(`Registered processor on ${AI_INTERVIEW_QUEUE}`);

    this.queueService.process<InterviewTranscriptionRequest>(
      AI_INTERVIEW_TRANSCRIPTION_QUEUE,
      async (job: QueueJob<InterviewTranscriptionRequest>) => {
        await this.runWithConcurrencyLimit(AI_INTERVIEW_TRANSCRIPTION_QUEUE, job.id, async () => {
          await this.handleInterviewTranscriptionJob(job);
        });
      },
      { concurrency: 3 },
    );
    this.logger.log(`Registered processor on ${AI_INTERVIEW_TRANSCRIPTION_QUEUE}`);

    this.queueService.process<GenerateSessionReportRequest>(
      AI_SESSION_REPORT_QUEUE,
      async (job: QueueJob<GenerateSessionReportRequest>) => {
        await this.runWithConcurrencyLimit(AI_SESSION_REPORT_QUEUE, job.id, async () => {
          await this.handleSessionReportJob(job);
        });
      },
      { concurrency: 1 },
    );
    this.logger.log(`Registered processor on ${AI_SESSION_REPORT_QUEUE}`);
  }

  private resolveMaxConcurrentAiJobs(configService?: ConfigService<EnvConfig>): number {
    const configuredLimit = configService?.get('AI_MAX_CONCURRENT_TASKS', { infer: true });
    if (configuredLimit !== undefined) {
      return configuredLimit;
    }
    return DEFAULT_MAX_CONCURRENT_AI_JOBS;
  }

  private resolveReservedRealtimeSlots(
    configService: ConfigService<EnvConfig> | undefined,
    maxConcurrentAiJobs: number,
  ): number {
    const configured = configService?.get('AI_RESERVED_REALTIME_SLOTS', { infer: true });
    const desired = configured ?? DEFAULT_RESERVED_REALTIME_SLOTS;
    return clampInt(desired, 0, Math.max(maxConcurrentAiJobs - 1, 0));
  }

  private resolveMaxConcurrentBatchAiJobs(
    configService: ConfigService<EnvConfig> | undefined,
    maxConcurrentAiJobs: number,
  ): number {
    const configured = configService?.get('AI_MAX_BATCH_CONCURRENT_TASKS', { infer: true });
    const desired = configured ?? maxConcurrentAiJobs;
    return clampInt(desired, 1, maxConcurrentAiJobs);
  }

  private async runWithConcurrencyLimit<T>(
    queueName: string,
    jobId: string,
    run: () => Promise<T>,
  ): Promise<T> {
    const waitMs = await this.acquireConcurrencySlot(queueName, jobId);
    if (waitMs > 0) {
      this.logger.debug(
        `Queue ${queueName} job ${jobId} acquired AI slot after waiting ${waitMs}ms`,
      );
    }

    try {
      return await run();
    } finally {
      this.releaseConcurrencySlot(queueName);
    }
  }

  private async acquireConcurrencySlot(queueName: string, jobId: string): Promise<number> {
    const taskClass = this.resolveTaskClass(queueName);
    const queuedAtMs = Date.now();

    if (this.canStartImmediately(taskClass)) {
      this.incrementActiveCounts(taskClass);
      return 0;
    }

    this.logger.debug(
      `Queue ${queueName} job ${jobId} waiting for AI slot (active=${this.activeAiJobs}/${this.maxConcurrentAiJobs}, class=${taskClass})`,
    );

    await new Promise<void>((resolve) => {
      this.pendingAiJobs.push({
        queueName,
        jobId,
        taskClass,
        priority: AI_JOB_PRIORITY[taskClass],
        queuedAtMs,
        grant: () => {
          this.incrementActiveCounts(taskClass);
          resolve();
        },
      });
    });

    return Date.now() - queuedAtMs;
  }

  private releaseConcurrencySlot(queueName: string): void {
    const taskClass = this.resolveTaskClass(queueName);
    this.activeAiJobs = Math.max(this.activeAiJobs - 1, 0);
    if (taskClass === 'realtime') {
      this.activeRealtimeAiJobs = Math.max(this.activeRealtimeAiJobs - 1, 0);
    } else {
      this.activeBatchAiJobs = Math.max(this.activeBatchAiJobs - 1, 0);
    }
    this.drainPendingAiJobs();
  }

  private drainPendingAiJobs(): void {
    while (this.activeAiJobs < this.maxConcurrentAiJobs && this.pendingAiJobs.length > 0) {
      const nextPendingJob = this.pickNextPendingJob();
      if (!nextPendingJob) {
        break;
      }

      if (!this.canStartImmediately(nextPendingJob.job.taskClass)) {
        break;
      }

      this.pendingAiJobs.splice(nextPendingJob.index, 1);
      const waitMs = Date.now() - nextPendingJob.job.queuedAtMs;
      if (waitMs >= 250) {
        this.logger.debug(
          `Queue ${nextPendingJob.job.queueName} job ${nextPendingJob.job.jobId} leaving wait queue after ${waitMs}ms`,
        );
      }
      nextPendingJob.job.grant();
    }
  }

  private pickNextPendingJob(): { index: number; job: PendingAiJob } | null {
    let bestIndex = -1;
    let bestJob: PendingAiJob | null = null;

    for (let index = 0; index < this.pendingAiJobs.length; index += 1) {
      const candidate = this.pendingAiJobs[index];
      if (!candidate) {
        continue;
      }

      if (!this.canStartImmediately(candidate.taskClass)) {
        continue;
      }

      if (
        !bestJob ||
        candidate.priority > bestJob.priority ||
        (candidate.priority === bestJob.priority && candidate.queuedAtMs < bestJob.queuedAtMs)
      ) {
        bestIndex = index;
        bestJob = candidate;
      }
    }

    return bestJob ? { index: bestIndex, job: bestJob } : null;
  }

  private canStartImmediately(taskClass: AiTaskClass): boolean {
    if (this.activeAiJobs >= this.maxConcurrentAiJobs) {
      return false;
    }

    if (taskClass === 'realtime') {
      return true;
    }

    if (this.activeBatchAiJobs >= this.maxConcurrentBatchAiJobs) {
      return false;
    }

    return this.activeAiJobs < this.maxConcurrentAiJobs - this.reservedRealtimeSlots;
  }

  private incrementActiveCounts(taskClass: AiTaskClass): void {
    this.activeAiJobs += 1;
    if (taskClass === 'realtime') {
      this.activeRealtimeAiJobs += 1;
    } else {
      this.activeBatchAiJobs += 1;
    }
  }

  private resolveTaskClass(queueName: string): AiTaskClass {
    if (REALTIME_QUEUE_NAMES.has(queueName)) {
      return 'realtime';
    }
    if (BATCH_QUEUE_NAMES.has(queueName)) {
      return 'batch';
    }
    return 'realtime';
  }

  private async handleHintJob(job: QueueJob<GenerateHintRequest>): Promise<void> {
    const { id: jobId, data: request } = job;
    this.logger.log(`Processing hint job ${jobId} (level=${request.hintLevel})`);

    // Errors should propagate so BullMQ retries on transient failures.
    const result = await this.aiService.generateHint(request);
    await this.queueService.enqueue(
      AI_HINT_RESULT_QUEUE,
      'hint-result',
      {
        ...result,
        jobId,
      },
      RESULT_JOB_OPTIONS,
    );

    this.logger.log(`Hint job ${jobId} completed`);
  }

  private async handleCodeAnalysisJob(job: QueueJob<AnalyzeCodeRequest>): Promise<void> {
    const { id: jobId, data: request } = job;
    this.logger.log(`Processing code analysis job ${jobId}`);

    const result = await this.aiService.analyzeCode(request);
    await this.queueService.enqueue(
      AI_CODE_ANALYSIS_RESULT_QUEUE,
      'code-analysis-result',
      {
        ...result,
        jobId,
      },
      RESULT_JOB_OPTIONS,
    );

    this.logger.log(`Code analysis job ${jobId} completed`);
  }

  private async handleWeaknessAnalysisJob(
    job: QueueJob<GenerateWeaknessAnalysisRequest>,
  ): Promise<void> {
    const { id: jobId, data: request } = job;
    this.logger.log(`Processing weakness analysis job ${jobId} for session ${request.sessionId}`);

    const result = await this.aiService.generateWeaknessAnalysis(request);
    await this.queueService.enqueue(
      AI_WEAKNESS_ANALYSIS_RESULT_QUEUE,
      'weakness-analysis-result',
      {
        ...result,
        jobId,
      },
      RESULT_JOB_OPTIONS,
    );

    this.logger.log(`Weakness analysis job ${jobId} completed`);
  }

  private async handleReviewJob(job: QueueJob<ReviewCodeRequest>): Promise<void> {
    const { id: jobId, data: request } = job;
    this.logger.log(`Processing review job ${jobId}`);

    // Errors should propagate so BullMQ retries on transient failures.
    const result = await this.aiService.reviewCode(request);
    await this.queueService.enqueue(
      AI_REVIEW_RESULT_QUEUE,
      'review-result',
      {
        ...result,
        jobId,
      },
      RESULT_JOB_OPTIONS,
    );

    this.logger.log(`Review job ${jobId} completed`);
  }

  private async handleInterviewJob(job: QueueJob<InterviewResponseRequest>): Promise<void> {
    const { id: jobId, data: request } = job;
    this.logger.log(`Processing interview job ${jobId}`);

    // Errors should propagate so BullMQ retries on transient failures.
    const result = await this.aiService.generateInterviewResponse(request);
    await this.queueService.enqueue(
      AI_INTERVIEW_RESULT_QUEUE,
      'interview-result',
      {
        ...result,
        jobId,
      },
      RESULT_JOB_OPTIONS,
    );

    this.logger.log(`Interview job ${jobId} completed`);
  }

  private async handleInterviewTranscriptionJob(
    job: QueueJob<InterviewTranscriptionRequest>,
  ): Promise<void> {
    const { id: jobId, data: request } = job;
    this.logger.log(`Processing interview transcription job ${jobId}`);
    try {
      const result = await this.aiService.generateInterviewTranscription(request);
      await this.queueService.enqueue(
        AI_INTERVIEW_TRANSCRIPTION_RESULT_QUEUE,
        'interview-transcription-result',
        {
          ...result,
          jobId,
        },
        RESULT_JOB_OPTIONS,
      );

      this.logger.log(`Interview transcription job ${jobId} completed`);
    } catch (error) {
      this.logger.error(
        `Interview transcription job ${jobId} failed for room ${request.roomId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private async handleSessionReportJob(job: QueueJob<GenerateSessionReportRequest>): Promise<void> {
    const { id: jobId, data: request } = job;
    this.logger.log(`Processing session report job ${jobId} for session ${request.sessionId}`);
    try {
      const result = await this.aiService.generateSessionReport(request);
      await this.queueService.enqueue(
        AI_SESSION_REPORT_RESULT_QUEUE,
        'session-report-result',
        {
          ...result,
          jobId,
        },
        RESULT_JOB_OPTIONS,
      );

      this.logger.log(`Session report job ${jobId} completed`);
    } catch (error) {
      this.logger.error(
        `Session report job ${jobId} failed for session ${request.sessionId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
