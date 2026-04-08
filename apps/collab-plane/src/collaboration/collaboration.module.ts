import { Module } from '@nestjs/common';
import { CollaborationGateway } from './collaboration.gateway.js';
import { CollaborationService } from './collaboration.service.js';

@Module({
  providers: [CollaborationGateway, CollaborationService],
  exports: [CollaborationService],
})
export class CollaborationModule {}
