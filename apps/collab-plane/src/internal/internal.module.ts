import { Module } from '@nestjs/common';
import { CollaborationModule } from '../collaboration/collaboration.module';
import { InternalController } from './internal.controller';

@Module({
  imports: [CollaborationModule],
  controllers: [InternalController],
})
export class InternalModule {}
