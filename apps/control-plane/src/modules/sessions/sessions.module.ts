import { Module } from '@nestjs/common';
import { SessionReportRequestBuilderService } from './session-report-request-builder.service.js';
import { SessionReportResultProcessor } from './session-report-result.processor.js';
import { SessionReportsService } from './session-reports.service.js';
import { SessionsController } from './sessions.controller.js';
import { SessionsService } from './sessions.service.js';

@Module({
  controllers: [SessionsController],
  providers: [
    SessionsService,
    SessionReportRequestBuilderService,
    SessionReportsService,
    SessionReportResultProcessor,
  ],
  exports: [SessionsService, SessionReportsService],
})
export class SessionsModule {}
