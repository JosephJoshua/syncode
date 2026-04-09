import { Injectable, Logger } from '@nestjs/common';
import type {
  CreateDocumentRequest,
  CreateDocumentResponse,
  DestroyDocumentResponse,
  ICollabClient,
  KickUserRequest,
  KickUserResponse,
  UpdateRoomStateRequest,
  UpdateRoomStateResponse,
} from '@syncode/contracts';
import { buildUrl, COLLAB_INTERNAL } from '@syncode/contracts';
import ky, { type KyInstance } from 'ky';

/**
 * HTTP-based collab plane client implementation
 */
@Injectable()
export class HttpCollabClient implements ICollabClient {
  private readonly logger = new Logger(HttpCollabClient.name);
  private readonly client: KyInstance;

  constructor(collabUrl: string) {
    this.client = ky.create({ prefixUrl: collabUrl, timeout: 10_000, retry: 0 });
  }

  async createDocument(request: CreateDocumentRequest): Promise<CreateDocumentResponse> {
    return this.client
      .post(COLLAB_INTERNAL.CREATE_DOCUMENT.route, { json: request })
      .json<CreateDocumentResponse>();
  }

  async destroyDocument(roomId: string): Promise<DestroyDocumentResponse> {
    return this.client
      .delete(buildUrl(COLLAB_INTERNAL.DESTROY_DOCUMENT.route, { roomId }))
      .json<DestroyDocumentResponse>();
  }

  async kickUser(roomId: string, request: KickUserRequest): Promise<KickUserResponse> {
    return this.client
      .post(buildUrl(COLLAB_INTERNAL.KICK_USER.route, { roomId }), { json: request })
      .json<KickUserResponse>();
  }

  async updateRoomState(request: UpdateRoomStateRequest): Promise<UpdateRoomStateResponse> {
    return this.client
      .post(buildUrl(COLLAB_INTERNAL.UPDATE_ROOM_STATE.route, { roomId: request.roomId }), {
        json: request,
      })
      .json<UpdateRoomStateResponse>();
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get(COLLAB_INTERNAL.HEALTH.route);
      return true;
    } catch {
      this.logger.warn('Collab plane health check failed');
      return false;
    }
  }
}
