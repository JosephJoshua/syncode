import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/index.js';
import { CollaborationGateway } from './collaboration.gateway.js';
import { CollaborationService } from './collaboration.service.js';

@Module({
  imports: [AuthModule],
  providers: [CollaborationGateway, CollaborationService],
  exports: [CollaborationService],
})
export class CollaborationModule {}
