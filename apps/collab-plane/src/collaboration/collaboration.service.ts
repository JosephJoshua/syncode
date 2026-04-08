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
import { RoomRegistry } from './room-registry.js';
import { WsCloseCode } from './ws-close-codes.js';

@Injectable()
export class CollaborationService {
  private readonly logger = new Logger(CollaborationService.name);

  constructor(
    private readonly roomRegistry: RoomRegistry,
    @Inject(CONTROL_PLANE_CALLBACK)
    private readonly callbackClient: IControlPlaneCallbackClient,
  ) {}

  async createDocument(request: CreateDocumentRequest): Promise<CreateDocumentResponse> {
    const room = this.roomRegistry.createRoom(request.roomId);
    this.logger.log(`Document created for room ${request.roomId}`);

    return {
      roomId: room.roomId,
      createdAt: room.createdAt,
    };
  }

  async destroyDocument(roomId: string): Promise<DestroyDocumentResponse> {
    const room = this.roomRegistry.getRoom(roomId);
    if (!room) {
      throw new NotFoundException(`Document not found for room ${roomId}`);
    }

    for (const [userId, client] of room.clients) {
      this.logger.debug(`Closing connection for user ${userId} in room ${roomId} (room destroyed)`);
      client.close(WsCloseCode.ROOM_CLOSED, 'Room closed');
    }

    this.roomRegistry.deleteRoom(roomId);
    this.logger.log(`Document destroyed for room ${roomId}`);

    return { roomId };
  }

  async kickUser(roomId: string, request: KickUserRequest): Promise<KickUserResponse> {
    const client = this.roomRegistry.getClient(roomId, request.userId);
    if (!client) {
      return { kicked: false };
    }

    this.logger.log(
      `Kicking user ${request.userId} from room ${roomId}: ${request.reason ?? 'no reason'}`,
    );
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
