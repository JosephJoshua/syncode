import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import {
  CONTROL_PLANE_CALLBACK,
  type IControlPlaneCallbackClient,
  type SnapshotTrigger,
} from '@syncode/contracts';
import { ROOM_STATUSES, type RoomStatus, type SupportedLanguage } from '@syncode/shared';
import { RoomRegistry } from './room-registry.js';
import { YjsDocumentStore } from './yjs-document-store.js';

function isPersistedPhase(value: string | undefined): value is RoomStatus {
  return typeof value === 'string' && (ROOM_STATUSES as readonly string[]).includes(value);
}

@Injectable()
export class SnapshotScheduler implements OnModuleDestroy {
  private readonly logger = new Logger(SnapshotScheduler.name);
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly docStore: YjsDocumentStore,
    @Inject(CONTROL_PLANE_CALLBACK)
    private readonly callbackClient: IControlPlaneCallbackClient,
    private readonly roomRegistry: RoomRegistry,
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

  async takeSnapshot(
    roomId: string,
    trigger: SnapshotTrigger,
    options: { strict?: boolean } = {},
  ): Promise<void> {
    const snapshot = this.encodeSnapshot(roomId, options.strict === true);
    if (!snapshot) {
      return;
    }

    const room = this.roomRegistry.getRoom(roomId);
    const language = (room?.language ?? null) as SupportedLanguage | null;

    // notifySnapshotReady carries language-specific payload (the code text +
    // the language for session reports). Skip it if no language is set yet —
    // but still persist the raw doc state below so non-code data such as
    // whiteboard records survives a server restart even before the user has
    // picked a language.
    if (language) {
      await this.notifyCodeSnapshot(roomId, snapshot, language, room?.phase, trigger, options);
      return;
    }

    // No language selected yet, but the doc may already hold whiteboard
    // (or future non-code) state. Persist the raw bytes so a refresh after
    // a server restart doesn't drop everything.
    await this.persistRawSnapshot(roomId, snapshot, options);
  }

  private encodeSnapshot(roomId: string, strict: boolean) {
    const snapshot = this.docStore.encodeSnapshot(roomId);
    if (snapshot || !strict) {
      return snapshot;
    }
    throw new Error(`Cannot take strict snapshot for missing document ${roomId}`);
  }

  private async notifyCodeSnapshot(
    roomId: string,
    snapshot: Uint8Array,
    language: SupportedLanguage,
    phase: string | undefined,
    trigger: SnapshotTrigger,
    options: { strict?: boolean },
  ): Promise<void> {
    const code = this.docStore.getCodeText(roomId, language);
    const persistedPhase = isPersistedPhase(phase) ? phase : null;
    await this.withSnapshotErrorHandling(roomId, options, 'send snapshot', () =>
      this.callbackClient.notifySnapshotReady({
        roomId,
        snapshot: Array.from(snapshot),
        code,
        language,
        timestamp: Date.now(),
        trigger,
        phase: persistedPhase,
      }),
    );
  }

  private async persistRawSnapshot(
    roomId: string,
    snapshot: Uint8Array,
    options: { strict?: boolean },
  ): Promise<void> {
    await this.withSnapshotErrorHandling(roomId, options, 'persist doc snapshot', () =>
      this.callbackClient.persistDocSnapshot(roomId, { state: Array.from(snapshot) }),
    );
  }

  private async withSnapshotErrorHandling(
    roomId: string,
    options: { strict?: boolean },
    action: string,
    callback: () => Promise<unknown>,
  ): Promise<void> {
    try {
      await callback();
    } catch (error) {
      this.logger.warn(
        `Failed to ${action} for room ${roomId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (options.strict) {
        throw error;
      }
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
