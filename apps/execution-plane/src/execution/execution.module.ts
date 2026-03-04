import { Module } from '@nestjs/common';
import { ExecutionProcessor } from './execution.processor';

@Module({
  providers: [ExecutionProcessor],
})
export class ExecutionModule {}
