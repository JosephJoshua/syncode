import { Module } from '@nestjs/common';
import { ExecutionController } from './execution.controller.js';
import { ExecutionService } from './execution.service.js';
import { ExecutionResultProcessor } from './execution-result.processor.js';

/**
 * Provides endpoints for retrieving code execution results.
 */
@Module({
  controllers: [ExecutionController],
  providers: [ExecutionService, ExecutionResultProcessor],
  exports: [ExecutionService],
})
export class ExecutionModule {}
