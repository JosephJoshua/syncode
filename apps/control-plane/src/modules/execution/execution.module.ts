import { Module } from '@nestjs/common';
import { ExecutionController } from './execution.controller.js';
import { ExecutionService } from './execution.service.js';

/**
 * Provides endpoints for retrieving code execution results.
 */
@Module({
  controllers: [ExecutionController],
  providers: [ExecutionService],
})
export class ExecutionModule {}
