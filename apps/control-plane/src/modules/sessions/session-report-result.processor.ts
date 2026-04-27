import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { AI_CLIENT, type GenerateSessionReportResult, type IAiClient } from '@syncode/contracts';
import { SessionReportsService } from './session-reports.service.js';

@Injectable()
export class SessionReportResultProcessor implements OnModuleInit {
  private readonly logger = new Logger(SessionReportResultProcessor.name);

  constructor(
    @Inject(AI_CLIENT) private readonly aiClient: IAiClient,
    private readonly sessionReportsService: SessionReportsService,
  ) {}

  onModuleInit(): void {
    this.aiClient.onSessionReportResult(this.handleResult.bind(this));
  }

  private async handleResult(jobId: string, result: GenerateSessionReportResult): Promise<void> {
    try {
      await this.sessionReportsService.handleResult(jobId, result);
    } catch (error) {
      this.logger.error(`Failed to persist session report for job ${jobId}`, error);
      throw error;
    }
  }
}
