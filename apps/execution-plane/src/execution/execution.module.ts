import { Module } from '@nestjs/common';
import { ExecutionProcessor } from './execution.processor.js';
import { StaticAnalysisProcessor } from './static-analysis.processor.js';
import {
  STATIC_ANALYSIS_COMMAND_RUNNER,
  StaticAnalysisAnalyzer,
} from './static-analysis-analyzer.service.js';
import { ChildProcessStaticAnalysisCommandRunner } from './static-analysis-command-runner.service.js';

@Module({
  providers: [
    ExecutionProcessor,
    StaticAnalysisProcessor,
    StaticAnalysisAnalyzer,
    {
      provide: STATIC_ANALYSIS_COMMAND_RUNNER,
      useClass: ChildProcessStaticAnalysisCommandRunner,
    },
  ],
})
export class ExecutionModule {}
