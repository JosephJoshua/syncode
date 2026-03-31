import { Module } from '@nestjs/common';
import { ProblemsController } from './problems.controller.js';
import { ProblemsService } from './problems.service.js';

/**
 * Manages coding problems and submissions.
 */
@Module({
  controllers: [ProblemsController],
  providers: [ProblemsService],
  exports: [ProblemsService],
})
export class ProblemsModule {}
