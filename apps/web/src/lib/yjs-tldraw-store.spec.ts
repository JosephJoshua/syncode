import { WHITEBOARD_KEY } from '@syncode/shared';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { applyHistoryEntryToYMap, createYjsTldrawStore, stampMeta } from './yjs-tldraw-store.js';

// We exercise the binding through three layers: the pure helpers (cheap,
// deterministic); the factory contract (store + undo manager wiring) without
// reaching for the tldraw editor (which would need DOM); and the Yjs side of
// the bridge end-to-end via a synthetic record. The full editor-driven flow is
// covered by the Playwright spec.

describe('stampMeta', () => {
  const baseRecord: { id: string; typeName: 'shape' } = {
    id: 'shape:abc',
    typeName: 'shape',
  };

  it('GIVEN remote source WHEN stamping THEN returns record unchanged', () => {
    const result = stampMeta(baseRecord as never, 'remote', 'alice', () => 'drawing');
    expect(result).toBe(baseRecord);
  });

  it('GIVEN user source on a record without meta WHEN stamping THEN populates authorId, layer, createdAt', () => {
    const before = Date.now();
    const result = stampMeta(baseRecord as never, 'user', 'alice', () => 'annotation') as {
      meta: { authorId: string; layer: string; createdAt: number };
    };
    expect(result.meta.authorId).toBe('alice');
    expect(result.meta.layer).toBe('annotation');
    expect(result.meta.createdAt).toBeGreaterThanOrEqual(before);
  });

  it('GIVEN record already carrying authorId WHEN stamping THEN preserves it', () => {
    const record = {
      ...baseRecord,
      meta: { authorId: 'preserved', layer: 'drawing' as const, createdAt: 42 },
    };
    const result = stampMeta(record as never, 'user', 'alice', () => 'annotation') as {
      meta: { authorId: string; layer: string; createdAt: number };
    };
    expect(result.meta.authorId).toBe('preserved');
    expect(result.meta.layer).toBe('drawing');
    expect(result.meta.createdAt).toBe(42);
  });
});

describe('applyHistoryEntryToYMap', () => {
  it('GIVEN added record WHEN applied THEN yMap holds it', () => {
    const doc = new Y.Doc();
    const yRecords = doc.getMap<unknown>('records') as Y.Map<{ id: string; typeName: string }>;
    const record = { id: 'shape:1', typeName: 'shape' };
    applyHistoryEntryToYMap(
      {
        source: 'user',
        changes: { added: { 'shape:1': record }, updated: {}, removed: {} },
      } as never,
      yRecords as never,
    );
    expect(yRecords.get('shape:1')).toEqual(record);
    doc.destroy();
  });

  it('GIVEN updated record WHEN applied THEN yMap reflects the after state', () => {
    const doc = new Y.Doc();
    const yRecords = doc.getMap<unknown>('records') as Y.Map<{ id: string; typeName: string }>;
    yRecords.set('shape:1', { id: 'shape:1', typeName: 'shape' });
    const after = { id: 'shape:1', typeName: 'shape', x: 100 };
    applyHistoryEntryToYMap(
      {
        source: 'user',
        changes: {
          added: {},
          updated: { 'shape:1': [{ id: 'shape:1', typeName: 'shape' }, after] },
          removed: {},
        },
      } as never,
      yRecords as never,
    );
    expect(yRecords.get('shape:1')).toEqual(after);
    doc.destroy();
  });

  it('GIVEN removed record WHEN applied THEN yMap drops the key', () => {
    const doc = new Y.Doc();
    const yRecords = doc.getMap<unknown>('records') as Y.Map<{ id: string; typeName: string }>;
    yRecords.set('shape:1', { id: 'shape:1', typeName: 'shape' });
    applyHistoryEntryToYMap(
      {
        source: 'user',
        changes: {
          added: {},
          updated: {},
          removed: { 'shape:1': { id: 'shape:1', typeName: 'shape' } },
        },
      } as never,
      yRecords as never,
    );
    expect(yRecords.get('shape:1')).toBeUndefined();
    doc.destroy();
  });
});

describe('createYjsTldrawStore', () => {
  function makeStore(doc: Y.Doc, userId: string) {
    return createYjsTldrawStore({
      doc,
      userId,
      userName: userId,
      userColor: '#ff00ff',
      getLayer: () => 'drawing',
    });
  }

  it('GIVEN fresh doc WHEN creating THEN whiteboard root has no nested records sub-map', () => {
    const doc = new Y.Doc();
    const result = makeStore(doc, 'alice');
    const root = doc.getMap(WHITEBOARD_KEY);
    // Records live directly under the root map (not in a sub-Y.Map) so that
    // two clients each materializing doc.getMap(WHITEBOARD_KEY) end up with
    // the same synced reference instead of racing on a sub-map. We assert
    // the absence of the historical nested layout that caused real-time
    // sync to silently fail in v1.
    expect(root.get('records')).toBeUndefined();
    expect(root.get('schema')).toBeUndefined();
    result.dispose();
    doc.destroy();
  });

  it('GIVEN two docs syncing via Y.applyUpdate WHEN A writes a record directly to its root THEN B observes it', () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();

    docA.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === 'from-b') return;
      Y.applyUpdate(docB, update, 'from-a');
    });
    docB.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === 'from-a') return;
      Y.applyUpdate(docA, update, 'from-b');
    });

    const aRoot = docA.getMap<{ id: string; typeName: string }>(WHITEBOARD_KEY);
    const bRoot = docB.getMap<{ id: string; typeName: string }>(WHITEBOARD_KEY);

    aRoot.set('shape:abc', { id: 'shape:abc', typeName: 'shape' });

    expect(bRoot.get('shape:abc')).toEqual({ id: 'shape:abc', typeName: 'shape' });

    docA.destroy();
    docB.destroy();
  });

  it('GIVEN created undo manager WHEN inspecting THEN only localOrigin is tracked', () => {
    const doc = new Y.Doc();
    const result = makeStore(doc, 'alice');

    expect(result.undoManager.trackedOrigins.has(result.localOrigin)).toBe(true);
    // We don't assert exclusivity (Y.UndoManager adds null/itself internally),
    // only that our localOrigin is the user-provided tracked sentinel.
    expect(result.undoManager.trackedOrigins.has('sync-from-remote')).toBe(false);

    result.dispose();
    doc.destroy();
  });

  it('GIVEN dispose WHEN called twice THEN does not throw', () => {
    const doc = new Y.Doc();
    const result = makeStore(doc, 'alice');
    expect(() => {
      result.dispose();
      result.dispose();
    }).not.toThrow();
    doc.destroy();
  });
});
