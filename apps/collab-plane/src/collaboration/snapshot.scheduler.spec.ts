import type { IControlPlaneCallbackClient } from '@syncode/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { SnapshotScheduler } from './snapshot.scheduler.js';
import { YjsDocumentStore } from './yjs-document-store.js';

describe('SnapshotScheduler', () => {
  let docStore: YjsDocumentStore;
  let callbackClient: IControlPlaneCallbackClient;
  let scheduler: SnapshotScheduler;

  beforeEach(() => {
    vi.useFakeTimers();

    docStore = new YjsDocumentStore();
    callbackClient = {
      notifyUserDisconnected: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      notifySnapshotReady: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    };
    scheduler = new SnapshotScheduler(docStore, callbackClient);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('takeSnapshot', () => {
    it('GIVEN doc with content WHEN taking snapshot THEN delivers reconstructable snapshot to control-plane', async () => {
      docStore.createDoc('room-1', 'const x = 1;');

      await scheduler.takeSnapshot('room-1', 'periodic');

      expect(callbackClient.notifySnapshotReady).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId: 'room-1',
          trigger: 'periodic',
          snapshot: expect.any(Array),
          timestamp: expect.any(Number),
        }),
      );

      // Verify the snapshot bytes actually reconstruct the document
      const payload = vi.mocked(callbackClient.notifySnapshotReady).mock.calls[0]![0];
      const restored = new Y.Doc();
      Y.applyUpdate(restored, new Uint8Array(payload.snapshot));
      expect(restored.getText('code').toString()).toBe('const x = 1;');
      restored.destroy();
    });

    it('GIVEN non-existent doc WHEN taking snapshot THEN does nothing', async () => {
      await scheduler.takeSnapshot('non-existent', 'periodic');

      expect(callbackClient.notifySnapshotReady).not.toHaveBeenCalled();
    });

    it('GIVEN callbackClient throws WHEN taking snapshot THEN does not rethrow', async () => {
      docStore.createDoc('room-1', 'const x = 1;');
      vi.mocked(callbackClient.notifySnapshotReady).mockRejectedValueOnce(
        new Error('Network error'),
      );

      await expect(scheduler.takeSnapshot('room-1', 'submission')).resolves.toBeUndefined();
    });
  });

  describe('startPeriodicSnapshots', () => {
    it('GIVEN room with doc WHEN 30s elapses THEN takes one periodic snapshot', async () => {
      docStore.createDoc('room-1', 'const x = 1;');
      scheduler.startPeriodicSnapshots('room-1');

      await vi.advanceTimersByTimeAsync(30_000);

      expect(callbackClient.notifySnapshotReady).toHaveBeenCalledWith(
        expect.objectContaining({ trigger: 'periodic' }),
      );
    });

    it('GIVEN startPeriodicSnapshots called twice WHEN 30s elapses THEN only one snapshot fires', async () => {
      docStore.createDoc('room-1', 'const x = 1;');
      scheduler.startPeriodicSnapshots('room-1');
      scheduler.startPeriodicSnapshots('room-1');

      await vi.advanceTimersByTimeAsync(30_000);

      expect(callbackClient.notifySnapshotReady).toHaveBeenCalledOnce();
    });
  });

  describe('stopPeriodicSnapshots', () => {
    it('GIVEN periodic snapshots started WHEN stopped THEN no more snapshots fire', async () => {
      docStore.createDoc('room-1', 'const x = 1;');
      scheduler.startPeriodicSnapshots('room-1');
      scheduler.stopPeriodicSnapshots('room-1');

      await vi.advanceTimersByTimeAsync(30_000);

      expect(callbackClient.notifySnapshotReady).not.toHaveBeenCalled();
    });
  });

  describe('destroyRoom', () => {
    it('GIVEN periodic snapshots started WHEN room destroyed THEN no more snapshots fire', async () => {
      docStore.createDoc('room-1', 'const x = 1;');
      scheduler.startPeriodicSnapshots('room-1');
      scheduler.destroyRoom('room-1');

      await vi.advanceTimersByTimeAsync(30_000);

      expect(callbackClient.notifySnapshotReady).not.toHaveBeenCalled();
    });
  });
});
