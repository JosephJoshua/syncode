import { Injectable, Logger } from '@nestjs/common';
import {
  CONTROL_INTERNAL,
  type IControlPlaneCallbackClient,
  type SnapshotReadyPayload,
  type UserDisconnectedPayload,
} from '@syncode/contracts';
import ky, { type KyInstance } from 'ky';

@Injectable()
export class HttpControlPlaneCallbackClient implements IControlPlaneCallbackClient {
  private readonly logger = new Logger(HttpControlPlaneCallbackClient.name);
  private readonly client: KyInstance;

  constructor(controlPlaneUrl: string) {
    this.client = ky.create({
      prefixUrl: controlPlaneUrl,
      timeout: 5_000,
      retry: {
        limit: 3,
        methods: ['post'],
        backoffLimit: 4_000,
      },
    });
  }

  async notifySnapshotReady(payload: SnapshotReadyPayload): Promise<void> {
    try {
      await this.client.post(CONTROL_INTERNAL.SNAPSHOT_READY.route, { json: payload });
      this.logger.debug(
        `Snapshot delivered for room ${payload.roomId} (trigger=${payload.trigger})`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to deliver snapshot (roomId=${payload.roomId}): ${(error as Error).message}`,
      );
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
}
