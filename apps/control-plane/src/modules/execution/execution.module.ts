import { Module } from '@nestjs/common';
import { ExecutionController } from './execution.controller';

/**
 * Provides endpoints for retrieving code execution results.
 */
@Module({
  controllers: [ExecutionController],
})
export class ExecutionModule {}
