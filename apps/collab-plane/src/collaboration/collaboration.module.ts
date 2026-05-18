import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/index.js';
import { AwarenessHandler } from './awareness.handler.js';
import { CollaborationGateway } from './collaboration.gateway.js';
import { CollaborationService } from './collaboration.service.js';
import { RoomRegistry } from './room-registry.js';
import { SnapshotScheduler } from './snapshot.scheduler.js';
import { YjsDocumentStore } from './yjs-document-store.js';
import { YjsSyncHandler } from './yjs-sync.handler.js';

@Module({
  imports: [AuthModule],
  providers: [
    RoomRegistry,
    YjsDocumentStore,
    YjsSyncHandler,
    AwarenessHandler,
    SnapshotScheduler,
    CollaborationGateway,
    CollaborationService,
  ],
  exports: [
    CollaborationService,
    RoomRegistry,
    YjsDocumentStore,
    YjsSyncHandler,
    AwarenessHandler,
    SnapshotScheduler,
  ],
})
export class CollaborationModule {}
