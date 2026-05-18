import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  STATIC_ANALYSIS_QUEUE,
  STATIC_ANALYSIS_RESULT_QUEUE,
  type StaticAnalysisRequest,
  type StaticAnalysisResult,
} from '@syncode/contracts';
import type { IQueueService, QueueJob } from '@syncode/shared/ports';
import { QUEUE_SERVICE } from '@syncode/shared/ports';
import { StaticAnalysisAnalyzer } from './static-analysis-analyzer.service.js';

const LOCK_DURATION_MS = 2 * 60 * 1_000;

@Injectable()
export class StaticAnalysisProcessor implements OnModuleInit {
  private readonly logger = new Logger(StaticAnalysisProcessor.name);

  constructor(
    @Inject(QUEUE_SERVICE) private readonly queueService: IQueueService,
    private readonly analyzer: StaticAnalysisAnalyzer,
  ) {}

  onModuleInit() {
    this.queueService.process<StaticAnalysisRequest>(
      STATIC_ANALYSIS_QUEUE,
      async (job) => {
        await this.handleJob(job);
      },
      { concurrency: 2, lockDuration: LOCK_DURATION_MS },
    );
    this.logger.log(`Registered processor on ${STATIC_ANALYSIS_QUEUE}`);
  }

  private async handleJob(job: QueueJob<StaticAnalysisRequest>): Promise<void> {
    const request = job.data;
    let result: StaticAnalysisResult;

    try {
      const analysis = await this.analyzer.analyze(request);
      result = {
        ...request,
        ...analysis,
        jobId: job.id,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result = {
        ...request,
        jobId: job.id,
        status: 'failed',
        error: message,
        summary: {
          diagnosticCount: 0,
          errorCount: 0,
          warningCount: 0,
          maxCyclomaticComplexity: null,
          highComplexityCount: 0,
          duplicationCount: 0,
          toolFailureCount: 0,
        },
        diagnostics: [],
        complexity: [],
        duplications: [],
        toolResults: [],
      };
    }

    await this.queueService.enqueue(
      STATIC_ANALYSIS_RESULT_QUEUE,
      'static-analysis-result',
      result,
      {
        removeOnComplete: 100,
        removeOnFail: false,
      },
    );
  }
}
