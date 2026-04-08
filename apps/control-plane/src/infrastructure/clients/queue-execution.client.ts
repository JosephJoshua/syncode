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
 * Queue-based execution client implementation
 */
@Injectable()
export class QueueExecutionClient implements IExecutionClient, OnModuleInit {
  private readonly logger = new Logger(QueueExecutionClient.name);
  private readonly helper: QueueClientHelper;

  constructor(
    @Inject(QUEUE_SERVICE) private readonly queueService: IQueueService,
    @Inject(CACHE_SERVICE) readonly cacheService: ICacheService,
  ) {
    this.helper = new QueueClientHelper(queueService, cacheService, this.logger, 'exec-result:');
  }

  async onModuleInit(): Promise<void> {
    this.helper.processResultQueue<RunCodeResult>(EXECUTION_RESULT_QUEUE, 'execution');
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

  async cancel(_jobId: JobId): Promise<void> {
    throw new NotImplementedException();
  }

  async healthCheck(): Promise<boolean> {
    try {
      const stats = await this.queueService.getQueueStats(EXECUTION_QUEUE);
      return stats != null;
    } catch (error) {
      this.logger.error('Health check failed', error);
      return false;
    }
  }
}
