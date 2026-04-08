import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/index.js';
import { CollaborationGateway } from './collaboration.gateway.js';
import { CollaborationService } from './collaboration.service.js';
import { RoomRegistry } from './room-registry.js';

@Module({
  imports: [AuthModule],
  providers: [RoomRegistry, CollaborationGateway, CollaborationService],
  exports: [CollaborationService, RoomRegistry],
})
export class CollaborationModule {}
