import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
} from '@nestjs/common';
import type {
  CreateDocumentRequest,
  CreateDocumentResponse,
  DestroyDocumentResponse,
  IControlPlaneCallbackClient,
  KickUserRequest,
  KickUserResponse,
  UpdateRoomStateRequest,
  UpdateRoomStateResponse,
  UserDisconnectedPayload,
} from '@syncode/contracts';
import { CONTROL_PLANE_CALLBACK } from '@syncode/contracts';
import { AwarenessHandler } from './awareness.handler.js';
import { RoomRegistry } from './room-registry.js';
import { SnapshotScheduler } from './snapshot.scheduler.js';
import { WsCloseCode } from './ws-close-codes.js';
import type { WsMessage } from './ws-message.types.js';
import { YjsDocumentStore } from './yjs-document-store.js';
import { YjsSyncHandler } from './yjs-sync.handler.js';

@Injectable()
export class CollaborationService implements OnModuleDestroy {
  private static readonly ROOM_TTL_MS = 5 * 60 * 1000;

  private readonly logger = new Logger(CollaborationService.name);
  private readonly roomTtls = new Map<string, NodeJS.Timeout>();

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
    const room = this.roomRegistry.createRoom(request.roomId, {
      phase: request.initialPhase,
      editorLocked: request.editorLocked,
    });
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

    this.cancelRoomCleanup(roomId);
    await this.snapshotScheduler.takeSnapshot(roomId, 'session_end');

    for (const [userId, client] of room.clients) {
      this.logger.debug(`Closing connection for user ${userId} in room ${roomId} (room destroyed)`);
      client.close(WsCloseCode.ROOM_CLOSED, 'Room closed');
    }

    const finalSnapshot = this.teardownRoom(roomId);
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
    this.checkRoomEmpty(roomId);

    return { kicked: true };
  }

  async updateRoomState(request: UpdateRoomStateRequest): Promise<UpdateRoomStateResponse> {
    const room = this.roomRegistry.updateRoomState(request.roomId, {
      phase: request.phase,
      editorLocked: request.editorLocked,
    });

    const roomStateMessage: WsMessage = {
      type: 'room-state',
      data: {
        phase: room.phase,
        editorLocked: room.editorLocked,
      },
      timestamp: Date.now(),
    };

    for (const client of room.clients.values()) {
      client.send(JSON.stringify(roomStateMessage));
    }

    this.logger.debug(
      `Room state updated for ${request.roomId}: phase=${request.phase}, editorLocked=${request.editorLocked}`,
    );

    return { success: true };
  }

  /**
   * Fire-and-forget notification to control-plane that a user disconnected.
   * The callback client catches errors internally per its port contract.
   */
  notifyUserDisconnected(payload: UserDisconnectedPayload): void {
    void this.callbackClient.notifyUserDisconnected(payload);
  }

  checkRoomEmpty(roomId: string): void {
    const room = this.roomRegistry.getRoom(roomId);
    if (room && room.clients.size === 0) {
      this.scheduleRoomCleanup(roomId);
    }
  }

  cancelRoomCleanup(roomId: string): void {
    const timer = this.roomTtls.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.roomTtls.delete(roomId);
      this.logger.debug(`Room TTL cancelled for ${roomId} (client reconnected)`);
    }
  }

  private scheduleRoomCleanup(roomId: string): void {
    if (this.roomTtls.has(roomId)) return;

    const timer = setTimeout(() => {
      this.roomTtls.delete(roomId);
      void this.cleanupRoom(roomId).catch((error: unknown) => {
        this.logger.error(
          `Failed to clean up room ${roomId} after TTL expiry: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }, CollaborationService.ROOM_TTL_MS);

    this.roomTtls.set(roomId, timer);
    this.logger.debug(`Room TTL scheduled for ${roomId} (5 minutes)`);
  }

  private async cleanupRoom(roomId: string): Promise<void> {
    if (!this.roomRegistry.hasRoom(roomId)) return;

    await this.snapshotScheduler.takeSnapshot(roomId, 'session_end');
    this.teardownRoom(roomId);
    this.logger.log(`Room ${roomId} cleaned up after TTL expiry`);
  }

  private teardownRoom(roomId: string): Uint8Array | undefined {
    this.snapshotScheduler.destroyRoom(roomId);
    this.awarenessHandler.destroyRoom(roomId);
    const snapshot = this.docStore.destroyDoc(roomId);
    this.roomRegistry.deleteRoom(roomId);
    return snapshot;
  }

  onModuleDestroy(): void {
    for (const [roomId, timer] of this.roomTtls) {
      clearTimeout(timer);
      this.logger.debug(`Room TTL cancelled for ${roomId} (shutdown)`);
    }
    this.roomTtls.clear();
  }
}
