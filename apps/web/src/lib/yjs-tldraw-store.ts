import { WHITEBOARD_KEY, type WhiteboardLayer, type WhiteboardShapeMeta } from '@syncode/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createTLStore,
  defaultBindingUtils,
  defaultShapeUtils,
  type HistoryEntry,
  type SerializedSchema,
  type StoreSnapshot,
  type TLAssetStore,
  type TLRecord,
  type TLStore,
} from 'tldraw';
import type { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';

export type WhiteboardConnectionStatus = 'loading' | 'ready';

export interface CreateYjsTldrawStoreOptions {
  doc: Y.Doc;
  assetStore?: TLAssetStore;
  awareness?: Awareness;
  userId: string;
  userName: string;
  userColor: string;
  // Returns the layer the next user-authored shape/asset should be tagged with.
  // Read synchronously inside the registerBeforeCreate handler so we capture the
  // value at creation time, not at React render time.
  getLayer: () => WhiteboardLayer;
}

export interface CreateYjsTldrawStoreResult {
  store: TLStore;
  undoManager: Y.UndoManager;
  // The opaque object used as the Yjs transaction origin for local writes.
  // Tests assert that remote-origin updates do NOT enter the local undo stack.
  localOrigin: object;
  dispose: () => void;
}

interface PersistedStoreSnapshot {
  store: StoreSnapshot<TLRecord>['store'];
  schema: SerializedSchema;
}

const RECORDS_KEY = 'records';
const SCHEMA_KEY = 'schema';

// Cap mass-create flushes so a paste of hundreds of shapes doesn't lock the
// main thread. Each transaction batches up to this many record writes; further
// writes spill into subsequent transactions but still preserve ordering.
const MAX_BATCH_PER_TRANSACTION = 256;

export function createYjsTldrawStore({
  doc,
  assetStore,
  awareness,
  userId,
  userName,
  userColor,
  getLayer,
}: CreateYjsTldrawStoreOptions): CreateYjsTldrawStoreResult {
  const localOrigin = { name: 'whiteboard-local' };

  const store = createTLStore({
    shapeUtils: [...defaultShapeUtils],
    bindingUtils: [...defaultBindingUtils],
    assets: assetStore,
  });

  const root = doc.getMap<unknown>(WHITEBOARD_KEY);
  const yRecords = getOrCreateMap<TLRecord>(root, RECORDS_KEY);
  const ySchema = getOrCreateMap<unknown>(root, SCHEMA_KEY);

  // Seed the local store from the Yjs map (after late-joiner sync) or seed
  // the Yjs map from the empty store if this client is the first writer.
  if (yRecords.size === 0) {
    doc.transact(() => {
      const records = store.allRecords();
      for (const record of records) {
        yRecords.set(record.id, record as TLRecord);
      }
      const snapshot = store.getStoreSnapshot();
      ySchema.set('value', snapshot.schema as unknown);
    }, localOrigin);
  } else {
    const records: TLRecord[] = [];
    yRecords.forEach((record) => {
      records.push(record as TLRecord);
    });
    if (records.length > 0) {
      store.mergeRemoteChanges(() => {
        store.put(records);
      });
    }
  }

  // Stamp author metadata on every locally created record so downstream
  // attribution UI can derive ownership without any additional plumbing.
  const beforeShapeCreate = store.sideEffects.registerBeforeCreateHandler(
    'shape',
    (shape, source) => stampMeta(shape, source, userId, getLayer),
  );
  const beforeAssetCreate = store.sideEffects.registerBeforeCreateHandler(
    'asset',
    (asset, source) => stampMeta(asset, source, userId, getLayer),
  );

  // Local store -> Yjs: forward user-driven changes into the shared map.
  const unsubscribeStore = store.listen(
    (entry: HistoryEntry<TLRecord>) => {
      doc.transact(() => {
        applyHistoryEntryToYMap(entry, yRecords);
      }, localOrigin);
    },
    { source: 'user', scope: 'document' },
  );

  // Yjs -> local store: apply remote-origin map changes back to the store.
  const onYRecordsChange = (event: Y.YMapEvent<TLRecord>, transaction: Y.Transaction) => {
    if (transaction.origin === localOrigin) return;
    const toPut: TLRecord[] = [];
    const toRemove: TLRecord['id'][] = [];
    event.changes.keys.forEach((change, key) => {
      if (change.action === 'delete') {
        toRemove.push(key as TLRecord['id']);
      } else {
        const record = yRecords.get(key);
        if (record) {
          toPut.push(record as TLRecord);
        }
      }
    });
    store.mergeRemoteChanges(() => {
      if (toRemove.length > 0) store.remove(toRemove);
      if (toPut.length > 0) store.put(toPut);
    });
  };
  yRecords.observe(onYRecordsChange);

  // Per-user undo: only operations originated locally enter the stack. Remote
  // peers' edits flow through the same yMap but are filtered out by origin.
  const undoManager = new Y.UndoManager(yRecords, {
    trackedOrigins: new Set([localOrigin]),
    captureTimeout: 500,
  });

  // Awareness: broadcast a minimal whiteboard presence under its own key so
  // the same Awareness instance can multiplex code-editor and whiteboard
  // cursors without colliding.
  if (awareness) {
    const previous = (awareness.getLocalState() ?? {}) as Record<string, unknown>;
    awareness.setLocalState({
      ...previous,
      whiteboard: {
        userId,
        userName,
        userColor,
      },
    });
  }

  return {
    store,
    undoManager,
    localOrigin,
    dispose: () => {
      unsubscribeStore();
      beforeShapeCreate();
      beforeAssetCreate();
      yRecords.unobserve(onYRecordsChange);
      undoManager.destroy();
      store.dispose();
    },
  };
}

export interface UseYjsTldrawStoreOptions extends CreateYjsTldrawStoreOptions {}

export interface UseYjsTldrawStoreResult {
  store: TLStore;
  undoManager: Y.UndoManager;
  status: WhiteboardConnectionStatus;
}

export function useYjsTldrawStore(options: UseYjsTldrawStoreOptions): UseYjsTldrawStoreResult {
  const { doc, assetStore, awareness, userId, userName, userColor, getLayer } = options;

  // getLayer is read synchronously inside the registerBeforeCreate handler so
  // we capture the value at creation time. Stash it in a ref so changing the
  // function reference between renders never tears down the store.
  const getLayerRef = useRef(getLayer);
  getLayerRef.current = getLayer;

  const result = useMemo(
    () =>
      createYjsTldrawStore({
        doc,
        assetStore,
        awareness,
        userId,
        userName,
        userColor,
        getLayer: () => getLayerRef.current(),
      }),
    [doc, assetStore, awareness, userId, userName, userColor],
  );

  const [status, setStatus] = useState<WhiteboardConnectionStatus>('ready');

  useEffect(() => {
    setStatus('ready');
    return () => {
      result.dispose();
    };
  }, [result]);

  return { store: result.store, undoManager: result.undoManager, status };
}

export function applyHistoryEntryToYMap(
  entry: HistoryEntry<TLRecord>,
  yRecords: Y.Map<TLRecord>,
): void {
  const writes: Array<() => void> = [];

  for (const [id, record] of Object.entries(entry.changes.added)) {
    writes.push(() => yRecords.set(id, record as TLRecord));
  }
  for (const [id, [, after]] of Object.entries(entry.changes.updated)) {
    writes.push(() => yRecords.set(id, after as TLRecord));
  }
  for (const id of Object.keys(entry.changes.removed)) {
    writes.push(() => yRecords.delete(id));
  }

  for (let i = 0; i < writes.length; i += MAX_BATCH_PER_TRANSACTION) {
    const slice = writes.slice(i, i + MAX_BATCH_PER_TRANSACTION);
    for (const write of slice) write();
  }
}

export function stampMeta<T extends TLRecord & { meta?: Record<string, unknown> }>(
  record: T,
  source: 'remote' | 'user',
  userId: string,
  getLayer: () => WhiteboardLayer,
): T {
  if (source !== 'user') return record;
  const existing = (record.meta ?? {}) as Partial<WhiteboardShapeMeta>;
  if (existing.authorId && existing.layer && existing.createdAt) return record;
  const meta: WhiteboardShapeMeta = {
    authorId: existing.authorId ?? userId,
    layer: existing.layer ?? getLayer(),
    createdAt: existing.createdAt ?? Date.now(),
  };
  return { ...record, meta: { ...existing, ...meta } };
}

function getOrCreateMap<V>(parent: Y.Map<unknown>, key: string): Y.Map<V> {
  let child = parent.get(key) as Y.Map<V> | undefined;
  if (!child) {
    child = new Y.Map<V>();
    parent.set(key, child);
  }
  return child;
}

// Re-export so callers that only need the persisted-snapshot shape don't have
// to reach into the tldraw module graph directly.
export type { PersistedStoreSnapshot };
