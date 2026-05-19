import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
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
  type AnalyzeCodeResult,
  type GenerateHintRequest,
  type GenerateHintResult,
  type GenerateSessionReportRequest,
  type GenerateSessionReportResult,
  type GenerateWeaknessAnalysisRequest,
  type GenerateWeaknessAnalysisResult,
  type IAiClient,
  type InterviewResponseRequest,
  type InterviewResponseResult,
  type InterviewTranscriptionRequest,
  type InterviewTranscriptionResult,
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
import { QueueClientHelper } from './queue-client.helpers.js';

/**
 * Queue-based AI client implementation
 */
@Injectable()
export class QueueAiClient implements IAiClient, OnModuleInit {
  private readonly logger = new Logger(QueueAiClient.name);
  private readonly helper: QueueClientHelper;
  private static readonly HINT_RESULT_NAMESPACE = 'hint';
  private static readonly CODE_ANALYSIS_RESULT_NAMESPACE = 'code-analysis';
  private static readonly WEAKNESS_ANALYSIS_RESULT_NAMESPACE = 'weakness-analysis';
  private static readonly REVIEW_RESULT_NAMESPACE = 'review';
  private static readonly INTERVIEW_RESULT_NAMESPACE = 'interview';
  private static readonly INTERVIEW_TRANSCRIPTION_RESULT_NAMESPACE = 'interview-transcription';
  private static readonly SESSION_REPORT_RESULT_NAMESPACE = 'session-report';
  private sessionReportResultCallback?: (
    jobId: string,
    result: GenerateSessionReportResult,
  ) => Promise<void>;
  private weaknessAnalysisResultCallback?: (
    jobId: string,
    result: GenerateWeaknessAnalysisResult,
  ) => Promise<void>;

  constructor(
    @Inject(QUEUE_SERVICE) private readonly queueService: IQueueService,
    @Inject(CACHE_SERVICE) readonly cacheService: ICacheService,
  ) {
    this.helper = new QueueClientHelper(queueService, cacheService, this.logger, 'ai-result:');
  }

  async onModuleInit(): Promise<void> {
    this.helper.processResultQueue<GenerateHintResult>(
      AI_HINT_RESULT_QUEUE,
      'hint',
      QueueAiClient.HINT_RESULT_NAMESPACE,
    );
    this.helper.processResultQueue<AnalyzeCodeResult>(
      AI_CODE_ANALYSIS_RESULT_QUEUE,
      'code-analysis',
      QueueAiClient.CODE_ANALYSIS_RESULT_NAMESPACE,
    );
    this.queueService.process<GenerateWeaknessAnalysisResult & { jobId: string }>(
      AI_WEAKNESS_ANALYSIS_RESULT_QUEUE,
      async (job) => {
        if (!job.data.jobId) {
          this.logger.warn('Received weakness-analysis result without jobId, skipping');
          return;
        }

        await this.cacheService.set(
          `ai-result:${QueueAiClient.WEAKNESS_ANALYSIS_RESULT_NAMESPACE}:${job.data.jobId}`,
          job.data,
          24 * 60 * 60,
        );
        this.logger.debug(`Cached weakness-analysis result for job ${job.data.jobId}`);

        if (this.weaknessAnalysisResultCallback) {
          await this.weaknessAnalysisResultCallback(job.data.jobId, job.data);
        }
      },
      { concurrency: 10 },
    );
    this.helper.processResultQueue<ReviewCodeResult>(
      AI_REVIEW_RESULT_QUEUE,
      'review',
      QueueAiClient.REVIEW_RESULT_NAMESPACE,
    );
    this.helper.processResultQueue<InterviewResponseResult>(
      AI_INTERVIEW_RESULT_QUEUE,
      'interview',
      QueueAiClient.INTERVIEW_RESULT_NAMESPACE,
    );
    this.helper.processResultQueue<InterviewTranscriptionResult>(
      AI_INTERVIEW_TRANSCRIPTION_RESULT_QUEUE,
      'interview-transcription',
      QueueAiClient.INTERVIEW_TRANSCRIPTION_RESULT_NAMESPACE,
    );
    this.queueService.process<GenerateSessionReportResult & { jobId: string }>(
      AI_SESSION_REPORT_RESULT_QUEUE,
      async (job) => {
        if (!job.data.jobId) {
          this.logger.warn('Received session-report result without jobId, skipping');
          return;
        }

        await this.cacheService.set(
          `ai-result:${QueueAiClient.SESSION_REPORT_RESULT_NAMESPACE}:${job.data.jobId}`,
          job.data,
          24 * 60 * 60,
        );
        this.logger.debug(`Cached session-report result for job ${job.data.jobId}`);

        if (this.sessionReportResultCallback) {
          await this.sessionReportResultCallback(job.data.jobId, job.data);
        }
      },
      { concurrency: 10 },
    );
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
    return this.helper.getResult<GenerateHintResult>(jobId, QueueAiClient.HINT_RESULT_NAMESPACE);
  }

  async submitCodeAnalysisRequest(
    request: AnalyzeCodeRequest,
  ): Promise<SubmitResult<'ai:code-analysis'>> {
    const jobId = await this.queueService.enqueue(AI_CODE_ANALYSIS_QUEUE, 'analyze-code', request, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1500 },
      removeOnComplete: 100,
      removeOnFail: false,
    });

    return { jobId };
  }

  async getCodeAnalysisResult(jobId: JobId<'ai:code-analysis'>): Promise<AnalyzeCodeResult | null> {
    return this.helper.getResult<AnalyzeCodeResult>(
      jobId,
      QueueAiClient.CODE_ANALYSIS_RESULT_NAMESPACE,
    );
  }

  async submitWeaknessAnalysisRequest(
    request: GenerateWeaknessAnalysisRequest,
  ): Promise<SubmitResult<'ai:weakness-analysis'>> {
    const jobId = await this.queueService.enqueue(
      AI_WEAKNESS_ANALYSIS_QUEUE,
      'generate-weakness-analysis',
      request,
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1500 },
        removeOnComplete: 100,
        removeOnFail: false,
      },
    );

    return { jobId: jobId as JobId<'ai:weakness-analysis'> };
  }

  async getWeaknessAnalysisResult(
    jobId: JobId<'ai:weakness-analysis'>,
  ): Promise<GenerateWeaknessAnalysisResult | null> {
    return this.helper.getResult<GenerateWeaknessAnalysisResult>(
      jobId,
      QueueAiClient.WEAKNESS_ANALYSIS_RESULT_NAMESPACE,
    );
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
    return this.helper.getResult<ReviewCodeResult>(jobId, QueueAiClient.REVIEW_RESULT_NAMESPACE);
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
    return this.helper.getResult<InterviewResponseResult>(
      jobId,
      QueueAiClient.INTERVIEW_RESULT_NAMESPACE,
    );
  }

  async submitInterviewTranscription(
    request: InterviewTranscriptionRequest,
  ): Promise<SubmitResult<'ai:interview-transcription'>> {
    const jobId = await this.queueService.enqueue(
      AI_INTERVIEW_TRANSCRIPTION_QUEUE,
      'interview-transcription',
      request,
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1500 },
        removeOnComplete: 100,
        removeOnFail: false,
      },
    );

    return { jobId: jobId as JobId<'ai:interview-transcription'> };
  }

  async getInterviewTranscriptionResult(
    jobId: JobId<'ai:interview-transcription'>,
  ): Promise<InterviewTranscriptionResult | null> {
    return this.helper.getResult<InterviewTranscriptionResult>(
      jobId,
      QueueAiClient.INTERVIEW_TRANSCRIPTION_RESULT_NAMESPACE,
    );
  }

  async submitSessionReportRequest(
    request: GenerateSessionReportRequest,
  ): Promise<SubmitResult<'ai:session-report'>> {
    const jobId = await this.queueService.enqueue(
      AI_SESSION_REPORT_QUEUE,
      'generate-session-report',
      request,
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1500 },
        removeOnComplete: 100,
        removeOnFail: false,
      },
    );

    return { jobId: jobId as JobId<'ai:session-report'> };
  }

  async getSessionReportResult(
    jobId: JobId<'ai:session-report'>,
  ): Promise<GenerateSessionReportResult | null> {
    return this.helper.getResult<GenerateSessionReportResult>(
      jobId,
      QueueAiClient.SESSION_REPORT_RESULT_NAMESPACE,
    );
  }

  async getHintJobStatus(jobId: JobId<'ai:hint'>): Promise<JobStatus> {
    return this.helper.getJobStatus(AI_HINT_QUEUE, jobId, QueueAiClient.HINT_RESULT_NAMESPACE);
  }

  async getCodeAnalysisJobStatus(jobId: JobId<'ai:code-analysis'>): Promise<JobStatus> {
    return this.helper.getJobStatus(
      AI_CODE_ANALYSIS_QUEUE,
      jobId,
      QueueAiClient.CODE_ANALYSIS_RESULT_NAMESPACE,
    );
  }

  async getWeaknessAnalysisJobStatus(jobId: JobId<'ai:weakness-analysis'>): Promise<JobStatus> {
    return this.helper.getJobStatus(
      AI_WEAKNESS_ANALYSIS_QUEUE,
      jobId,
      QueueAiClient.WEAKNESS_ANALYSIS_RESULT_NAMESPACE,
    );
  }

  async getReviewJobStatus(jobId: JobId<'ai:review'>): Promise<JobStatus> {
    return this.helper.getJobStatus(AI_REVIEW_QUEUE, jobId, QueueAiClient.REVIEW_RESULT_NAMESPACE);
  }

  async getInterviewJobStatus(jobId: JobId<'ai:interview'>): Promise<JobStatus> {
    return this.helper.getJobStatus(
      AI_INTERVIEW_QUEUE,
      jobId,
      QueueAiClient.INTERVIEW_RESULT_NAMESPACE,
    );
  }

  async getInterviewTranscriptionJobStatus(
    jobId: JobId<'ai:interview-transcription'>,
  ): Promise<JobStatus> {
    return this.helper.getJobStatus(
      AI_INTERVIEW_TRANSCRIPTION_QUEUE,
      jobId,
      QueueAiClient.INTERVIEW_TRANSCRIPTION_RESULT_NAMESPACE,
    );
  }

  async getSessionReportJobStatus(jobId: JobId<'ai:session-report'>): Promise<JobStatus> {
    return this.helper.getJobStatus(
      AI_SESSION_REPORT_QUEUE,
      jobId,
      QueueAiClient.SESSION_REPORT_RESULT_NAMESPACE,
    );
  }

  onSessionReportResult(
    callback: (jobId: string, result: GenerateSessionReportResult) => Promise<void>,
  ): void {
    this.sessionReportResultCallback = callback;
  }

  onWeaknessAnalysisResult(
    callback: (jobId: string, result: GenerateWeaknessAnalysisResult) => Promise<void>,
  ): void {
    this.weaknessAnalysisResultCallback = callback;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const [
        hintStats,
        codeAnalysisStats,
        weaknessAnalysisStats,
        reviewStats,
        interviewStats,
        interviewTranscriptionStats,
        sessionReportStats,
      ] = await Promise.all([
        this.queueService.getQueueStats(AI_HINT_QUEUE),
        this.queueService.getQueueStats(AI_CODE_ANALYSIS_QUEUE),
        this.queueService.getQueueStats(AI_WEAKNESS_ANALYSIS_QUEUE),
        this.queueService.getQueueStats(AI_REVIEW_QUEUE),
        this.queueService.getQueueStats(AI_INTERVIEW_QUEUE),
        this.queueService.getQueueStats(AI_INTERVIEW_TRANSCRIPTION_QUEUE),
        this.queueService.getQueueStats(AI_SESSION_REPORT_QUEUE),
      ]);

      return (
        hintStats != null &&
        codeAnalysisStats != null &&
        weaknessAnalysisStats != null &&
        reviewStats != null &&
        interviewStats != null &&
        interviewTranscriptionStats != null &&
        sessionReportStats != null
      );
    } catch (error) {
      this.logger.error('Health check failed', error);
      return false;
    }
  }
}
