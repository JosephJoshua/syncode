import type { IControlPlaneCallbackClient } from '@syncode/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    it('GIVEN doc with content WHEN taking snapshot THEN calls notifySnapshotReady with correct payload', async () => {
      docStore.createDoc('room-1', 'const x = 1;');

      await scheduler.takeSnapshot('room-1', 'periodic');

      expect(callbackClient.notifySnapshotReady).toHaveBeenCalledOnce();
      const payload = vi.mocked(callbackClient.notifySnapshotReady).mock.calls[0][0];
      expect(payload.roomId).toBe('room-1');
      expect(payload.trigger).toBe('periodic');
      expect(payload.snapshot).toBeInstanceOf(Array);
      expect(payload.snapshot.length).toBeGreaterThan(0);
      expect(payload.timestamp).toBeTypeOf('number');
    });

    it('GIVEN non-existent doc WHEN taking snapshot THEN does nothing', async () => {
      await scheduler.takeSnapshot('non-existent', 'periodic');

      expect(callbackClient.notifySnapshotReady).not.toHaveBeenCalled();
    });

    it('GIVEN callbackClient throws WHEN taking snapshot THEN catches error and does not rethrow', async () => {
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

      expect(callbackClient.notifySnapshotReady).toHaveBeenCalledOnce();
      const payload = vi.mocked(callbackClient.notifySnapshotReady).mock.calls[0][0];
      expect(payload.trigger).toBe('periodic');
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
