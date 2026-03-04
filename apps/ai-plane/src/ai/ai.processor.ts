import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  AI_HINT_QUEUE,
  AI_HINT_RESULT_QUEUE,
  AI_INTERVIEW_QUEUE,
  AI_INTERVIEW_RESULT_QUEUE,
  AI_REVIEW_QUEUE,
  AI_REVIEW_RESULT_QUEUE,
  type GenerateHintRequest,
  type InterviewResponseRequest,
  type ReviewCodeRequest,
} from '@syncode/contracts';
import type { IQueueService, QueueJob } from '@syncode/shared/ports';
import { QUEUE_SERVICE } from '@syncode/shared/ports';
import { AiService } from './ai.service';

@Injectable()
export class AiProcessor implements OnModuleInit {
  private readonly logger = new Logger(AiProcessor.name);

  constructor(
    @Inject(QUEUE_SERVICE) private readonly queueService: IQueueService,
    private readonly aiService: AiService,
  ) {}

  onModuleInit() {
    this.queueService.process<GenerateHintRequest>(
      AI_HINT_QUEUE,
      async (job: QueueJob<GenerateHintRequest>) => {
        await this.handleHintJob(job);
      },
      { concurrency: 5 },
    );
    this.logger.log(`Registered processor on ${AI_HINT_QUEUE}`);

    this.queueService.process<ReviewCodeRequest>(
      AI_REVIEW_QUEUE,
      async (job: QueueJob<ReviewCodeRequest>) => {
        await this.handleReviewJob(job);
      },
      { concurrency: 3 },
    );
    this.logger.log(`Registered processor on ${AI_REVIEW_QUEUE}`);

    this.queueService.process<InterviewResponseRequest>(
      AI_INTERVIEW_QUEUE,
      async (job: QueueJob<InterviewResponseRequest>) => {
        await this.handleInterviewJob(job);
      },
      { concurrency: 3 },
    );
    this.logger.log(`Registered processor on ${AI_INTERVIEW_QUEUE}`);
  }

  private async handleHintJob(job: QueueJob<GenerateHintRequest>): Promise<void> {
    const { id: jobId, data: request } = job;
    this.logger.log(`Processing hint job ${jobId} (level=${request.hintLevel})`);

    // Errors should propagate so BullMQ retries on transient failures.
    const result = await this.aiService.generateHint(request);
    await this.queueService.enqueue(AI_HINT_RESULT_QUEUE, 'hint-result', { ...result, jobId });

    this.logger.log(`Hint job ${jobId} completed`);
  }

  private async handleReviewJob(job: QueueJob<ReviewCodeRequest>): Promise<void> {
    const { id: jobId, data: request } = job;
    this.logger.log(`Processing review job ${jobId}`);

    // Errors should propagate so BullMQ retries on transient failures.
    const result = await this.aiService.reviewCode(request);
    await this.queueService.enqueue(AI_REVIEW_RESULT_QUEUE, 'review-result', { ...result, jobId });

    this.logger.log(`Review job ${jobId} completed`);
  }

  private async handleInterviewJob(job: QueueJob<InterviewResponseRequest>): Promise<void> {
    const { id: jobId, data: request } = job;
    this.logger.log(`Processing interview job ${jobId}`);

    // Errors should propagate so BullMQ retries on transient failures.
    const result = await this.aiService.generateInterviewResponse(request);
    await this.queueService.enqueue(AI_INTERVIEW_RESULT_QUEUE, 'interview-result', {
      ...result,
      jobId,
    });

    this.logger.log(`Interview job ${jobId} completed`);
  }
}
