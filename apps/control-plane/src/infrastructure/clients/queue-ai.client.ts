import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  AI_HINT_QUEUE,
  AI_HINT_RESULT_QUEUE,
  AI_INTERVIEW_QUEUE,
  AI_INTERVIEW_RESULT_QUEUE,
  AI_REVIEW_QUEUE,
  AI_REVIEW_RESULT_QUEUE,
  type GenerateHintRequest,
  type GenerateHintResult,
  type IAiClient,
  type InterviewResponseRequest,
  type InterviewResponseResult,
  type JobId,
  type JobStatus,
  type ReviewCodeRequest,
  type ReviewCodeResult,
  type SubmitResult,
} from '@syncode/contracts';
import {
  CACHE_SERVICE,
  type ICacheService,
  type IQueueService,
  QUEUE_SERVICE,
} from '@syncode/shared/ports';
import { QueueClientHelper } from './queue-client.helpers';

/**
 * Queue-based AI client implementation
 */
@Injectable()
export class QueueAiClient implements IAiClient, OnModuleInit {
  private readonly logger = new Logger(QueueAiClient.name);
  private readonly helper: QueueClientHelper;

  constructor(
    @Inject(QUEUE_SERVICE) private readonly queueService: IQueueService,
    @Inject(CACHE_SERVICE) readonly cacheService: ICacheService,
  ) {
    this.helper = new QueueClientHelper(queueService, cacheService, this.logger, 'ai-result:');
  }

  async onModuleInit(): Promise<void> {
    this.helper.processResultQueue<GenerateHintResult>(AI_HINT_RESULT_QUEUE, 'hint');
    this.helper.processResultQueue<ReviewCodeResult>(AI_REVIEW_RESULT_QUEUE, 'review');
    this.helper.processResultQueue<InterviewResponseResult>(AI_INTERVIEW_RESULT_QUEUE, 'interview');
  }

  async submitHintRequest(request: GenerateHintRequest): Promise<SubmitResult<'ai:hint'>> {
    const jobId = await this.queueService.enqueue(AI_HINT_QUEUE, 'generate-hint', request, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1500 },
      removeOnComplete: 100,
      removeOnFail: false,
    });

    return { jobId: jobId as JobId<'ai:hint'> };
  }

  async getHintResult(jobId: JobId<'ai:hint'>): Promise<GenerateHintResult | null> {
    return this.helper.getResult<GenerateHintResult>(jobId);
  }

  async submitReviewRequest(request: ReviewCodeRequest): Promise<SubmitResult<'ai:review'>> {
    const jobId = await this.queueService.enqueue(AI_REVIEW_QUEUE, 'review-code', request, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1500 },
      removeOnComplete: 100,
      removeOnFail: false,
    });

    return { jobId: jobId as JobId<'ai:review'> };
  }

  async getReviewResult(jobId: JobId<'ai:review'>): Promise<ReviewCodeResult | null> {
    return this.helper.getResult<ReviewCodeResult>(jobId);
  }

  async submitInterviewResponse(
    request: InterviewResponseRequest,
  ): Promise<SubmitResult<'ai:interview'>> {
    const jobId = await this.queueService.enqueue(
      AI_INTERVIEW_QUEUE,
      'interview-response',
      request,
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1500 },
        removeOnComplete: 100,
        removeOnFail: false,
      },
    );

    return { jobId: jobId as JobId<'ai:interview'> };
  }

  async getInterviewResult(jobId: JobId<'ai:interview'>): Promise<InterviewResponseResult | null> {
    return this.helper.getResult<InterviewResponseResult>(jobId);
  }

  async getHintJobStatus(jobId: JobId<'ai:hint'>): Promise<JobStatus> {
    return this.helper.getJobStatus(AI_HINT_QUEUE, jobId);
  }

  async getReviewJobStatus(jobId: JobId<'ai:review'>): Promise<JobStatus> {
    return this.helper.getJobStatus(AI_REVIEW_QUEUE, jobId);
  }

  async getInterviewJobStatus(jobId: JobId<'ai:interview'>): Promise<JobStatus> {
    return this.helper.getJobStatus(AI_INTERVIEW_QUEUE, jobId);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const [hintStats, reviewStats, interviewStats] = await Promise.all([
        this.queueService.getQueueStats(AI_HINT_QUEUE),
        this.queueService.getQueueStats(AI_REVIEW_QUEUE),
        this.queueService.getQueueStats(AI_INTERVIEW_QUEUE),
      ]);

      return hintStats != null && reviewStats != null && interviewStats != null;
    } catch (error) {
      this.logger.error('Health check failed', error);
      return false;
    }
  }
}
