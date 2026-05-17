import { Injectable, Logger } from '@nestjs/common';
import {
  type AuthorizeJoinRequest,
  type AuthorizeJoinResponse,
  buildUrl,
  CONTROL_INTERNAL,
  type IControlPlaneCallbackClient,
  type ParticipantHeartbeatRequest,
  type ParticipantHeartbeatResponse,
  type PersistDocSnapshotPayload,
  type PersistDocSnapshotResponse,
  type SnapshotReadyPayload,
  type SnapshotReadyResponse,
  type UserDisconnectedPayload,
} from '@syncode/contracts';
import ky, { type KyInstance } from 'ky';

@Injectable()
export class HttpControlPlaneCallbackClient implements IControlPlaneCallbackClient {
  private readonly logger = new Logger(HttpControlPlaneCallbackClient.name);
  private readonly client: KyInstance;

  constructor(controlPlaneUrl: string, internalSecret: string) {
    this.client = ky.create({
      prefixUrl: controlPlaneUrl,
      timeout: 5_000,
      headers: {
        'X-Internal-Secret': internalSecret,
      },
      retry: {
        limit: 3,
        methods: ['post'],
        backoffLimit: 4_000,
      },
    });
  }

  async notifySnapshotReady(payload: SnapshotReadyPayload): Promise<void> {
    try {
      const response = await this.client
        .post(CONTROL_INTERNAL.SNAPSHOT_READY.route, { json: payload })
        .json<SnapshotReadyResponse>();
      if (!response.success) {
        throw new Error(`Control-plane rejected code snapshot for room ${payload.roomId}`);
      }
      this.logger.debug(
        `Snapshot delivered for room ${payload.roomId} (trigger=${payload.trigger})`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to deliver snapshot (roomId=${payload.roomId}): ${(error as Error).message}`,
      );
      throw error;
    }
  }

  async notifyUserDisconnected(payload: UserDisconnectedPayload): Promise<void> {
    try {
      await this.client.post(CONTROL_INTERNAL.USER_DISCONNECTED.route, { json: payload });
      this.logger.debug(
        `Notified control-plane: user ${payload.userId} disconnected from room ${payload.roomId}`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to notify user disconnect (userId=${payload.userId}, roomId=${payload.roomId}): ${(error as Error).message}`,
      );
    }
  }

  async heartbeatParticipants(
    request: ParticipantHeartbeatRequest,
  ): Promise<ParticipantHeartbeatResponse | null> {
    try {
      const response = await this.client
        .post(CONTROL_INTERNAL.PARTICIPANT_HEARTBEAT.route, { json: request })
        .json<ParticipantHeartbeatResponse>();
      this.logger.debug(
        `Participant heartbeat delivered (batch=${request.participants.length}, updated=${response.updated})`,
      );
      return response;
    } catch (error) {
      this.logger.warn(
        `Failed to deliver participant heartbeat (batch=${request.participants.length}): ${(error as Error).message}`,
      );
      return null;
    }
  }

  async authorizeJoin(roomId: string, userId: string): Promise<AuthorizeJoinResponse> {
    const url = buildUrl(CONTROL_INTERNAL.AUTHORIZE_JOIN.route, { roomId });
    const body: AuthorizeJoinRequest = { userId };
    try {
      return await this.client.post(url, { json: body }).json<AuthorizeJoinResponse>();
    } catch (error) {
      this.logger.warn(
        `Failed to authorize join (roomId=${roomId}, userId=${userId}): ${(error as Error).message}`,
      );
      // Fail closed: deny the join if we cannot reach control-plane.
      return { authorized: false };
    }
  }

  async persistDocSnapshot(roomId: string, payload: PersistDocSnapshotPayload): Promise<void> {
    try {
      const path = buildUrl(CONTROL_INTERNAL.PERSIST_DOC_SNAPSHOT.route, { roomId });
      const response = await this.client
        .post(path, { json: payload })
        .json<PersistDocSnapshotResponse>();
      if (!response.success) {
        throw new Error(`Control-plane rejected doc snapshot for room ${roomId}`);
      }
      this.logger.debug(
        `Persisted doc snapshot for room ${roomId} (${payload.state.length} bytes)`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to persist doc snapshot (roomId=${roomId}): ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
