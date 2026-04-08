import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import {
  CONTROL_PLANE_CALLBACK,
  type IControlPlaneCallbackClient,
  type SnapshotTrigger,
} from '@syncode/contracts';
import { YjsDocumentStore } from './yjs-document-store.js';

@Injectable()
export class SnapshotScheduler implements OnModuleDestroy {
  private readonly logger = new Logger(SnapshotScheduler.name);
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly docStore: YjsDocumentStore,
    @Inject(CONTROL_PLANE_CALLBACK)
    private readonly callbackClient: IControlPlaneCallbackClient,
  ) {}

  startPeriodicSnapshots(roomId: string): void {
    if (this.timers.has(roomId)) {
      return;
    }

    const timer = setInterval(() => void this.takeSnapshot(roomId, 'periodic'), 30_000);
    this.timers.set(roomId, timer);
    this.logger.log(`Started periodic snapshots for room ${roomId}`);
  }

  stopPeriodicSnapshots(roomId: string): void {
    const timer = this.timers.get(roomId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(roomId);
      this.logger.log(`Stopped periodic snapshots for room ${roomId}`);
    }
  }

  async takeSnapshot(roomId: string, trigger: SnapshotTrigger): Promise<void> {
    const snapshot = this.docStore.encodeSnapshot(roomId);
    if (!snapshot) return;

    const code = this.docStore.getCodeText(roomId);

    try {
      await this.callbackClient.notifySnapshotReady({
        roomId,
        snapshot: Array.from(snapshot),
        code,
        timestamp: Date.now(),
        trigger,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send snapshot for room ${roomId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  destroyRoom(roomId: string): void {
    this.stopPeriodicSnapshots(roomId);
  }

  onModuleDestroy(): void {
    for (const [roomId, timer] of this.timers) {
      clearInterval(timer);
      this.logger.debug(`Snapshot timer cleared for room ${roomId} (shutdown)`);
    }
    this.timers.clear();
  }
}
