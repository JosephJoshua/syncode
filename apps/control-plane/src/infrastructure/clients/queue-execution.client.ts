import {
  Inject,
  Injectable,
  Logger,
  NotImplementedException,
  type OnModuleInit,
} from '@nestjs/common';
import {
  EXECUTION_QUEUE,
  EXECUTION_RESULT_QUEUE,
  type IExecutionClient,
  type JobId,
  type JobStatus,
  type RunCodeRequest,
  type RunCodeResult,
  STATIC_ANALYSIS_QUEUE,
  STATIC_ANALYSIS_RESULT_QUEUE,
  type StaticAnalysisRequest,
  type StaticAnalysisResult,
  type SubmitResult,
  type SubmitStaticAnalysisOptions,
} from '@syncode/contracts';
import {
  CACHE_SERVICE,
  type ICacheService,
  type IQueueService,
  QUEUE_SERVICE,
} from '@syncode/shared/ports';
import { QueueClientHelper } from './queue-client.helpers.js';

/**
 * Queue-based execution client implementation
 */
@Injectable()
export class QueueExecutionClient implements IExecutionClient, OnModuleInit {
  private readonly logger = new Logger(QueueExecutionClient.name);
  private readonly helper: QueueClientHelper<RunCodeResult>;
  private readonly staticAnalysisHelper: QueueClientHelper<StaticAnalysisResult>;

  constructor(
    @Inject(QUEUE_SERVICE) private readonly queueService: IQueueService,
    @Inject(CACHE_SERVICE) readonly cacheService: ICacheService,
  ) {
    this.helper = new QueueClientHelper<RunCodeResult>(
      queueService,
      cacheService,
      this.logger,
      'exec-result:',
    );
    this.staticAnalysisHelper = new QueueClientHelper<StaticAnalysisResult>(
      queueService,
      cacheService,
      this.logger,
      'exec-static-analysis-result:',
    );
  }

  async onModuleInit(): Promise<void> {
    this.helper.processResultQueue<RunCodeResult>(EXECUTION_RESULT_QUEUE, 'execution');
    this.staticAnalysisHelper.processResultQueue<StaticAnalysisResult>(
      STATIC_ANALYSIS_RESULT_QUEUE,
      'static-analysis',
    );
  }

  async submit(request: RunCodeRequest): Promise<SubmitResult<'execution'>> {
    const jobId = await this.queueService.enqueue(EXECUTION_QUEUE, 'run-code', request, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: false,
    });

    return { jobId: jobId as JobId<'execution'> };
  }

  async getResult(jobId: JobId<'execution'>): Promise<RunCodeResult | null> {
    return this.helper.getResult<RunCodeResult>(jobId);
  }

  async getJobStatus(jobId: JobId): Promise<JobStatus> {
    return this.helper.getJobStatus(EXECUTION_QUEUE, jobId);
  }

  async submitStaticAnalysis(
    request: StaticAnalysisRequest,
    options?: SubmitStaticAnalysisOptions,
  ): Promise<SubmitResult<'static-analysis'>> {
    const jobId = await this.queueService.enqueue(
      STATIC_ANALYSIS_QUEUE,
      'static-analysis',
      request,
      {
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: false,
        idempotencyKey: options?.idempotencyKey,
      },
    );

    return { jobId };
  }

  async getStaticAnalysisResult(
    jobId: JobId<'static-analysis'>,
  ): Promise<StaticAnalysisResult | null> {
    return this.staticAnalysisHelper.getResult<StaticAnalysisResult>(jobId);
  }

  async getStaticAnalysisJobStatus(jobId: JobId): Promise<JobStatus> {
    return this.staticAnalysisHelper.getJobStatus(STATIC_ANALYSIS_QUEUE, jobId);
  }

  onResult(callback: (jobId: string, result: RunCodeResult) => Promise<void>): void {
    this.helper.setResultCallback(callback);
  }

  onStaticAnalysisResult(
    callback: (jobId: string, result: StaticAnalysisResult) => Promise<void>,
  ): void {
    this.staticAnalysisHelper.setResultCallback(callback);
  }

  async cancel(_jobId: JobId): Promise<void> {
    throw new NotImplementedException();
  }

  async healthCheck(): Promise<boolean> {
    try {
      const [executionStats, staticAnalysisStats] = await Promise.all([
        this.queueService.getQueueStats(EXECUTION_QUEUE),
        this.queueService.getQueueStats(STATIC_ANALYSIS_QUEUE),
      ]);
      return executionStats != null && staticAnalysisStats != null;
    } catch (error) {
      this.logger.error('Health check failed', error);
      return false;
    }
  }
}
