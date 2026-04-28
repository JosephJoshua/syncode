import type { IControlPlaneCallbackClient } from '@syncode/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { RoomRegistry } from './room-registry.js';
import { SnapshotScheduler } from './snapshot.scheduler.js';
import { YjsDocumentStore } from './yjs-document-store.js';

describe('SnapshotScheduler', () => {
  let docStore: YjsDocumentStore;
  let callbackClient: IControlPlaneCallbackClient;
  let roomRegistry: RoomRegistry;
  let scheduler: SnapshotScheduler;

  beforeEach(() => {
    vi.useFakeTimers();

    docStore = new YjsDocumentStore();
    callbackClient = {
      notifyUserDisconnected: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      notifySnapshotReady: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      heartbeatParticipants: vi.fn<() => Promise<null>>().mockResolvedValue(null),
      authorizeJoin: vi
        .fn<() => Promise<{ authorized: boolean }>>()
        .mockResolvedValue({ authorized: true }),
      persistDocSnapshot: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    };
    roomRegistry = new RoomRegistry();
    scheduler = new SnapshotScheduler(docStore, callbackClient, roomRegistry);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('takeSnapshot', () => {
    it('GIVEN room with active language WHEN taking snapshot THEN delivers plain-text code for that language', async () => {
      roomRegistry.createRoom('room-1', { language: 'python' });
      docStore.createDoc('room-1', {
        initialContentByLanguage: { python: 'const x = 1;', javascript: 'const y = 2;' },
      });

      await scheduler.takeSnapshot('room-1', 'periodic');

      expect(callbackClient.notifySnapshotReady).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId: 'room-1',
          trigger: 'periodic',
          snapshot: expect.any(Array),
          code: 'const x = 1;',
          language: 'python',
          timestamp: expect.any(Number),
        }),
      );

      // Verify the binary snapshot still preserves every language (polyglot Y.Doc)
      const payload = vi.mocked(callbackClient.notifySnapshotReady).mock.calls[0]![0];
      const restored = new Y.Doc();
      Y.applyUpdate(restored, new Uint8Array(payload.snapshot));
      expect(restored.getText('code:python').toString()).toBe('const x = 1;');
      expect(restored.getText('code:javascript').toString()).toBe('const y = 2;');
      restored.destroy();
    });

    it('GIVEN room with active language WHEN language switches THEN next snapshot uses the new language', async () => {
      roomRegistry.createRoom('room-1', { language: 'python' });
      docStore.createDoc('room-1', {
        initialContentByLanguage: { python: 'print(1)', javascript: 'console.log(2)' },
      });

      roomRegistry.updateLanguage('room-1', 'javascript');
      await scheduler.takeSnapshot('room-1', 'periodic');

      expect(callbackClient.notifySnapshotReady).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'console.log(2)', language: 'javascript' }),
      );
    });

    it('GIVEN room without an active language WHEN taking snapshot THEN skips notifySnapshotReady but still persists raw doc state', async () => {
      roomRegistry.createRoom('room-1');
      docStore.createDoc('room-1', {
        initialContentByLanguage: { python: 'const x = 1;' },
      });

      await scheduler.takeSnapshot('room-1', 'periodic');

      // The language-aware notifySnapshotReady is skipped (no language to
      // attach), but raw doc state is still persisted so non-code data such
      // as whiteboard records survives a server restart.
      expect(callbackClient.notifySnapshotReady).not.toHaveBeenCalled();
      expect(callbackClient.persistDocSnapshot).toHaveBeenCalledWith(
        'room-1',
        expect.objectContaining({ state: expect.any(Array) }),
      );
    });

    it('GIVEN room without language AND persistDocSnapshot rejects WHEN taking snapshot THEN does not rethrow', async () => {
      roomRegistry.createRoom('room-1');
      docStore.createDoc('room-1');
      vi.mocked(callbackClient.persistDocSnapshot).mockRejectedValueOnce(new Error('boom'));

      await expect(scheduler.takeSnapshot('room-1', 'periodic')).resolves.toBeUndefined();
    });

    it('GIVEN non-existent doc WHEN taking snapshot THEN does nothing', async () => {
      await scheduler.takeSnapshot('non-existent', 'periodic');

      expect(callbackClient.notifySnapshotReady).not.toHaveBeenCalled();
    });

    it('GIVEN callbackClient throws WHEN taking snapshot THEN does not rethrow', async () => {
      roomRegistry.createRoom('room-1', { language: 'python' });
      docStore.createDoc('room-1', { initialContentByLanguage: { python: 'const x = 1;' } });
      vi.mocked(callbackClient.notifySnapshotReady).mockRejectedValueOnce(
        new Error('Network error'),
      );

      await expect(scheduler.takeSnapshot('room-1', 'submission')).resolves.toBeUndefined();
    });
  });

  describe('startPeriodicSnapshots', () => {
    it('GIVEN room with doc WHEN 30s elapses THEN takes one periodic snapshot', async () => {
      roomRegistry.createRoom('room-1', { language: 'python' });
      docStore.createDoc('room-1', { initialContentByLanguage: { python: 'const x = 1;' } });
      scheduler.startPeriodicSnapshots('room-1');

      await vi.advanceTimersByTimeAsync(30_000);

      expect(callbackClient.notifySnapshotReady).toHaveBeenCalledWith(
        expect.objectContaining({ trigger: 'periodic' }),
      );
    });

    it('GIVEN startPeriodicSnapshots called twice WHEN 30s elapses THEN only one snapshot fires', async () => {
      roomRegistry.createRoom('room-1', { language: 'python' });
      docStore.createDoc('room-1', { initialContentByLanguage: { python: 'const x = 1;' } });
      scheduler.startPeriodicSnapshots('room-1');
      scheduler.startPeriodicSnapshots('room-1');

      await vi.advanceTimersByTimeAsync(30_000);

      expect(callbackClient.notifySnapshotReady).toHaveBeenCalledOnce();
    });
  });

  describe('stopPeriodicSnapshots', () => {
    it('GIVEN periodic snapshots started WHEN stopped THEN no more snapshots fire', async () => {
      roomRegistry.createRoom('room-1', { language: 'python' });
      docStore.createDoc('room-1', { initialContentByLanguage: { python: 'const x = 1;' } });
      scheduler.startPeriodicSnapshots('room-1');
      scheduler.stopPeriodicSnapshots('room-1');

      await vi.advanceTimersByTimeAsync(30_000);

      expect(callbackClient.notifySnapshotReady).not.toHaveBeenCalled();
    });
  });

  describe('destroyRoom', () => {
    it('GIVEN periodic snapshots started WHEN room destroyed THEN no more snapshots fire', async () => {
      roomRegistry.createRoom('room-1', { language: 'python' });
      docStore.createDoc('room-1', { initialContentByLanguage: { python: 'const x = 1;' } });
      scheduler.startPeriodicSnapshots('room-1');
      scheduler.destroyRoom('room-1');

      await vi.advanceTimersByTimeAsync(30_000);

      expect(callbackClient.notifySnapshotReady).not.toHaveBeenCalled();
    });
  });
});
