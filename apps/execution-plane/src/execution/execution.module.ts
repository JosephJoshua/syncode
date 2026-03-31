import { Module } from '@nestjs/common';
import { ExecutionProcessor } from './execution.processor.js';

@Module({
  providers: [ExecutionProcessor],
})
export class ExecutionModule {}
