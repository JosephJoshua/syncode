import { Module } from '@nestjs/common';
import { CollaborationModule } from '../collaboration/collaboration.module.js';
import { InternalCallbackGuard } from '../common/guards/internal-callback.guard.js';
import { HealthController } from './health.controller.js';
import { InternalController } from './internal.controller.js';

@Module({
  imports: [CollaborationModule],
  controllers: [HealthController, InternalController],
  providers: [InternalCallbackGuard],
})
export class InternalModule {}
