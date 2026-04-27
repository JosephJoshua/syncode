import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
} from '@nestjs/common';
import type {
  ChangeLanguageRequest,
  ChangeLanguageResponse,
  CreateDocumentRequest,
  CreateDocumentResponse,
  DestroyDocumentResponse,
  IControlPlaneCallbackClient,
  KickUserRequest,
  KickUserResponse,
  ParticipantHeartbeatRequest,
  UpdateRoomStateRequest,
  UpdateRoomStateResponse,
  UserDisconnectedPayload,
} from '@syncode/contracts';
import { COLLAB_WS_EVENTS, CONTROL_PLANE_CALLBACK } from '@syncode/contracts';
import * as Y from 'yjs';
import { AwarenessHandler } from './awareness.handler.js';
import { type RoomEntry, RoomRegistry } from './room-registry.js';
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
    const existingRoom = this.roomRegistry.getRoom(request.roomId);
    const room =
      existingRoom ??
      this.roomRegistry.createRoom(request.roomId, {
        phase: request.initialPhase,
        editorLocked: request.editorLocked,
        language: request.initialLanguage,
      });

    const snapshot = request.snapshot ? new Uint8Array(request.snapshot) : undefined;
    const { created } = this.docStore.createDoc(request.roomId, {
      snapshot,
      initialContentByLanguage: request.initialContentByLanguage,
    });

    if (created) {
      this.syncHandler.registerUpdateBroadcast(request.roomId);
      this.awarenessHandler.createRoom(request.roomId);
      this.snapshotScheduler.startPeriodicSnapshots(request.roomId);
      this.logger.log(`Document created for room ${request.roomId}`);
    } else {
      this.logger.debug(`Document already exists for room ${request.roomId}`);
    }

    return { roomId: room.roomId, createdAt: room.createdAt, created };
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
    const { room, previousPhase, previousEditorLocked } = this.roomRegistry.updateRoomState(
      request.roomId,
      {
        phase: request.phase,
        editorLocked: request.editorLocked,
      },
    );

    const now = Date.now();

    this.broadcastJson(room, {
      type: COLLAB_WS_EVENTS.ROOM_STATE,
      data: { phase: room.phase, editorLocked: room.editorLocked },
      timestamp: now,
    });

    if (previousPhase !== request.phase) {
      this.broadcastJson(room, {
        type: COLLAB_WS_EVENTS.PHASE_CHANGE,
        data: { phase: request.phase, previousPhase },
        timestamp: now,
      });

      void this.snapshotScheduler.takeSnapshot(request.roomId, 'phase_change');
    }

    if (previousEditorLocked !== request.editorLocked) {
      this.broadcastJson(room, {
        type: COLLAB_WS_EVENTS.EDITOR_LOCK,
        data: {
          locked: request.editorLocked,
          lockedBy: request.editorLocked ? (request.changedBy ?? null) : null,
        },
        timestamp: now,
      });

      if (request.editorLocked) {
        void this.snapshotScheduler.takeSnapshot(request.roomId, 'submission');
      }
    }

    this.logger.debug(
      `Room state updated for ${request.roomId}: phase=${request.phase}, editorLocked=${request.editorLocked}`,
    );

    return { success: true };
  }

  async changeLanguage(request: ChangeLanguageRequest): Promise<ChangeLanguageResponse> {
    const room = this.roomRegistry.getRoom(request.roomId);
    if (!room) {
      this.logger.debug(`changeLanguage: room ${request.roomId} not found; no broadcast sent`);
      return { success: false };
    }

    // Update the registry BEFORE broadcasting so a concurrent periodic snapshot
    // reads the new active language rather than the old one.
    this.roomRegistry.updateLanguage(request.roomId, request.language);

    this.broadcastJson(room, {
      type: COLLAB_WS_EVENTS.LANGUAGE_CHANGE,
      data: {
        language: request.language,
        changedBy: request.changedBy ?? null,
      },
      timestamp: Date.now(),
    });

    this.logger.debug(
      `Language change broadcast for room ${request.roomId}: language=${request.language}`,
    );

    return { success: true };
  }

  broadcastParticipantReady(roomId: string, userId: string, isReady: boolean): void {
    const room = this.roomRegistry.getRoom(roomId);
    if (!room) return;

    this.broadcastJson(room, {
      type: COLLAB_WS_EVENTS.PARTICIPANT_READY,
      data: { userId, isReady },
      timestamp: Date.now(),
    });
  }

  notifyUserDisconnected(payload: UserDisconnectedPayload): void {
    void this.callbackClient.notifyUserDisconnected(payload);
  }

  /**
   * Fire-and-forget participant-heartbeat delivery to control-plane.
   * The callback client swallows errors per its port contract, but we wrap
   * in a try/catch defensively in case a synchronous throw ever occurs.
   */
  heartbeatParticipants(participants: ParticipantHeartbeatRequest['participants']): void {
    if (participants.length === 0) return;
    try {
      void this.callbackClient.heartbeatParticipants({ participants });
    } catch (error) {
      this.logger.warn(
        `Failed to dispatch participant heartbeat: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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

  private broadcastJson(room: RoomEntry, message: WsMessage): void {
    const serialized = JSON.stringify(message);
    for (const client of room.clients.values()) {
      client.send(serialized);
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
    await this.persistFinalState(roomId);
    this.teardownRoom(roomId);
    this.logger.log(`Room ${roomId} cleaned up after TTL expiry`);
  }

  private async persistFinalState(roomId: string): Promise<void> {
    const doc = this.docStore.getDoc(roomId);
    if (!doc) return;

    try {
      const state = Y.encodeStateAsUpdate(doc);
      await this.callbackClient.persistDocSnapshot(roomId, { state: Array.from(state) });
    } catch (error) {
      this.logger.warn(
        `Failed to persist doc snapshot for room ${roomId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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
