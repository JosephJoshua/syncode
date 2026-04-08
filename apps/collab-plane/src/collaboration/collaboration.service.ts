import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type {
  CreateDocumentRequest,
  CreateDocumentResponse,
  DestroyDocumentResponse,
  IControlPlaneCallbackClient,
  KickUserRequest,
  KickUserResponse,
  UserDisconnectedPayload,
} from '@syncode/contracts';
import { CONTROL_PLANE_CALLBACK } from '@syncode/contracts';
import { AwarenessHandler } from './awareness.handler.js';
import { RoomRegistry } from './room-registry.js';
import { SnapshotScheduler } from './snapshot.scheduler.js';
import { WsCloseCode } from './ws-close-codes.js';
import { YjsDocumentStore } from './yjs-document-store.js';
import { YjsSyncHandler } from './yjs-sync.handler.js';

@Injectable()
export class CollaborationService {
  private readonly logger = new Logger(CollaborationService.name);

  constructor(
    private readonly roomRegistry: RoomRegistry,
    @Inject(CONTROL_PLANE_CALLBACK)
    private readonly callbackClient: IControlPlaneCallbackClient,
    private readonly docStore: YjsDocumentStore,
    private readonly syncHandler: YjsSyncHandler,
    private readonly awarenessHandler: AwarenessHandler,
    private readonly snapshotScheduler: SnapshotScheduler,
  ) {}

  async createDocument(request: CreateDocumentRequest): Promise<CreateDocumentResponse> {
    const room = this.roomRegistry.createRoom(request.roomId);
    this.docStore.createDoc(request.roomId, request.initialContent);
    this.syncHandler.registerUpdateBroadcast(request.roomId);
    this.awarenessHandler.createRoom(request.roomId);
    this.snapshotScheduler.startPeriodicSnapshots(request.roomId);

    this.logger.log(`Document created for room ${request.roomId}`);
    return { roomId: room.roomId, createdAt: room.createdAt };
  }

  async destroyDocument(roomId: string): Promise<DestroyDocumentResponse> {
    const room = this.roomRegistry.getRoom(roomId);
    if (!room) {
      throw new NotFoundException(`Document not found for room ${roomId}`);
    }

    await this.snapshotScheduler.takeSnapshot(roomId, 'session_end');
    this.snapshotScheduler.destroyRoom(roomId);

    for (const [userId, client] of room.clients) {
      this.logger.debug(`Closing connection for user ${userId} in room ${roomId} (room destroyed)`);
      client.close(WsCloseCode.ROOM_CLOSED, 'Room closed');
    }

    this.awarenessHandler.destroyRoom(roomId);
    const finalSnapshot = this.docStore.destroyDoc(roomId);
    this.roomRegistry.deleteRoom(roomId);

    this.logger.log(`Document destroyed for room ${roomId}`);
    return {
      roomId,
      finalSnapshot: finalSnapshot ? Array.from(finalSnapshot) : undefined,
    };
  }

  async kickUser(roomId: string, request: KickUserRequest): Promise<KickUserResponse> {
    const client = this.roomRegistry.getClient(roomId, request.userId);
    if (!client) {
      return { kicked: false };
    }

    this.logger.log(
      `Kicking user ${request.userId} from room ${roomId}: ${request.reason ?? 'no reason'}`,
    );
    this.awarenessHandler.removeClient(roomId, request.userId);
    this.roomRegistry.removeClient(roomId, request.userId);
    client.close(WsCloseCode.KICKED, request.reason ?? 'Kicked');

    return { kicked: true };
  }

  /**
   * Fire-and-forget notification to control-plane that a user disconnected.
   * The callback client catches errors internally per its port contract.
   */
  notifyUserDisconnected(payload: UserDisconnectedPayload): void {
    void this.callbackClient.notifyUserDisconnected(payload);
  }
}
