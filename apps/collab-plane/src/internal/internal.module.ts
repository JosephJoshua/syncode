import { Module } from '@nestjs/common';
import { CollaborationModule } from '../collaboration/collaboration.module.js';
import { InternalController } from './internal.controller.js';

@Module({
  imports: [CollaborationModule],
  controllers: [InternalController],
})
export class InternalModule {}
