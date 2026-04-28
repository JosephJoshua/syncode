import { WHITEBOARD_KEY, type WhiteboardLayer, type WhiteboardShapeMeta } from '@syncode/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createTLStore,
  defaultBindingUtils,
  defaultShapeUtils,
  type HistoryEntry,
  type TLAssetStore,
  type TLRecord,
  type TLStore,
  type TLStoreWithStatus,
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
  // Attach the local-store -> Yjs forwarder to a different store than the one
  // returned by createYjsTldrawStore. Use this from inside Tldraw's onMount
  // callback when the editor exposes a wrapped store: editor.store is the
  // object that actually emits user-source events, and pre-attaching a
  // listener to the original store misses them.
  attachLocalStoreForwarder: (target: TLStore) => () => void;
}

// Cap mass-create flushes so a paste of hundreds of shapes doesn't lock the
// main thread. Each transaction batches up to this many record writes; further
// writes spill into subsequent transactions but still preserve ordering.
const MAX_BATCH_PER_TRANSACTION = 256;

// Defensive runtime guard: only objects with a string id and typeName
// (matching tldraw's record shape) are treated as records. Filters out
// legacy Y.Map sub-instances and anything else that ended up in the
// whiteboard root by accident. Declared as a `const` arrow function so it
// is fully initialized by the time the closures inside createYjsTldrawStore
// reference it during HMR/bundler module evaluation.
const isTldrawRecord = (value: unknown, key: string): value is TLRecord => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { id?: unknown; typeName?: unknown };
  if (typeof candidate.id !== 'string' || typeof candidate.typeName !== 'string') return false;
  return candidate.id === key;
};

// JSON round-trip strips functions, undefined, symbols, and any field that
// would make Yjs's internal structuredClone choke. tldraw records are
// documented to be JSON-serializable; this is purely defensive against
// stray non-clonable references getting attached by upstream code paths
// (e.g. asset preloaders that briefly attach a Promise resolver).
export const sanitizeForYjs = <T>(value: T): T | null => {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return null;
  }
};

// Apply remote records to the local store one-by-one, tolerating per-record
// validation failures. Returns the records that failed so the caller can
// retry once the rest of the batch has been applied (resolving simple
// dependency ordering races).
const applyRecordsResilient = (store: TLStore, records: TLRecord[]): TLRecord[] => {
  const failed: TLRecord[] = [];
  for (const record of records) {
    try {
      store.put([record]);
    } catch (error) {
      failed.push(record);
      if (import.meta.env?.DEV) {
        console.warn('[whiteboard] failed to apply record', record.id, error);
      }
    }
  }
  return failed;
};

// Cap the number of retry passes so a record that genuinely fails validation
// (not just a dependency-ordering issue) doesn't loop forever.
const MAX_HYDRATION_PASSES = 4;

const hydrateFromRemote = (store: TLStore, records: TLRecord[]): void => {
  store.mergeRemoteChanges(() => {
    let pending = records;
    for (let pass = 0; pass < MAX_HYDRATION_PASSES && pending.length > 0; pass++) {
      const failed = applyRecordsResilient(store, pending);
      if (failed.length === pending.length) break; // no progress this pass — stop
      pending = failed;
    }
  });
};

// The visibility filter sets shape.opacity to a tint/hidden value in the
// LOCAL store only (so each client can hide annotations independently). But
// when the user later moves that shape, the user-source HistoryEntry carries
// the locally-mutated opacity — without this normalization step it would leak
// to peers and corrupt the canonical doc state. Whiteboard shapes always have
// meta.layer; we normalize their opacity to a canonical 1 on the way out so
// the per-client visibility tint never crosses the wire.
const normalizeShapeForYjs = <T extends TLRecord>(record: T): T => {
  if (record.typeName !== 'shape') return record;
  const meta = (record as unknown as { meta?: { layer?: unknown } }).meta;
  if (!meta || meta.layer === undefined) return record;
  return { ...record, opacity: 1 } as T;
};

// Forward a tldraw HistoryEntry into the shared Y.Map. Sanitize each record
// via JSON round-trip so non-cloneable fields don't poison Yjs's internal
// structuredClone path. Each MAX_BATCH_PER_TRANSACTION-sized slice runs in
// its own transaction so a paste of hundreds of shapes doesn't lock the main
// thread inside one giant Yjs transaction.
export const applyHistoryEntryToYMap = (
  entry: HistoryEntry<TLRecord>,
  yRecords: Y.Map<TLRecord>,
  // Optional: invoked once per slice so the caller can wrap each batch in
  // its own transaction (with a stable origin). When omitted, the caller is
  // expected to wrap the whole call themselves.
  runInTransaction?: (fn: () => void) => void,
): void => {
  const writes: Array<() => void> = [];

  for (const [id, record] of Object.entries(entry.changes.added)) {
    const sanitized = sanitizeForYjs(normalizeShapeForYjs(record));
    if (sanitized) writes.push(() => yRecords.set(id, sanitized));
  }
  for (const [id, [, after]] of Object.entries(entry.changes.updated)) {
    const sanitized = sanitizeForYjs(normalizeShapeForYjs(after));
    if (sanitized) writes.push(() => yRecords.set(id, sanitized));
  }
  for (const id of Object.keys(entry.changes.removed)) {
    writes.push(() => yRecords.delete(id));
  }

  for (let i = 0; i < writes.length; i += MAX_BATCH_PER_TRANSACTION) {
    const slice = writes.slice(i, i + MAX_BATCH_PER_TRANSACTION);
    const apply = () => {
      for (const write of slice) write();
    };
    if (runInTransaction) {
      runInTransaction(apply);
    } else {
      apply();
    }
  }
};

// Stamp author metadata onto every locally-created record so the legend and
// layer-aware UI can derive ownership without any extra plumbing. Returns
// remote-source records unchanged.
export const stampMeta = <T extends TLRecord & { meta?: Record<string, unknown> }>(
  record: T,
  source: 'remote' | 'user',
  userId: string,
  getLayer: () => WhiteboardLayer,
): T => {
  if (source !== 'user') return record;
  const existing = (record.meta ?? {}) as Partial<WhiteboardShapeMeta>;
  if (existing.authorId && existing.layer && existing.createdAt) return record;
  const meta: WhiteboardShapeMeta = {
    authorId: existing.authorId ?? userId,
    layer: existing.layer ?? getLayer(),
    createdAt: existing.createdAt ?? Date.now(),
  };
  return { ...record, meta: { ...existing, ...meta } };
};

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

  // Use the top-level whiteboard map directly. The server materializes
  // doc.getMap(WHITEBOARD_KEY) on document creation, so every client gets
  // the same synced root reference. Nesting a sub-Y.Map inside it would race
  // — two clients each creating a fresh sub-map on first connect would lose
  // one side's writes to last-writer-wins resolution. tldraw record ids are
  // already prefixed (shape:, asset:, page:, ...) so storing them directly
  // in the root map collides with nothing.
  const yRecords = doc.getMap<TLRecord>(WHITEBOARD_KEY);

  // Hydrate the local store from any records already present in the shared
  // map (late-joiner case). Records may have inter-references (a shape
  // points at its parent page; a page state references a current page) and
  // tldraw's strict schema validation throws when a record arrives before
  // its dependency. Fall back to per-record put so a single validation
  // failure doesn't drop the whole batch.
  //
  // We also defensively filter out anything that isn't a tldraw record:
  // legacy snapshots from a previous nested-Y.Map layout can leave behind
  // Y.Map sub-instances at this level, which look like {} with no id field.
  const initialRecords: TLRecord[] = [];
  yRecords.forEach((value, key) => {
    if (isTldrawRecord(value, key)) initialRecords.push(value);
  });
  if (initialRecords.length > 0) {
    hydrateFromRemote(store, initialRecords);
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
  // Each batch slice runs in its own transaction so large pastes are split
  // into multiple smaller transactions instead of one giant one.
  //
  // Filter via the entry's own `source` field rather than store.listen's
  // built-in source filter — some tldraw transactions report sources
  // outside the documented {'user','remote'} pair, which the built-in
  // filter would silently drop.
  //
  // The forwarder is exposed as a function so it can be attached to whichever
  // store tldraw actually uses internally. Tldraw 4.5 with the
  // TLStoreWithStatus collaboration mode wraps the provided store, so the
  // editor.store reachable from onMount is a DIFFERENT object than the one
  // we created here. Pre-attaching the listener to our store would miss every
  // user event. The room-whiteboard-panel calls attachLocalStoreForwarder
  // from inside onMount with editor.store.
  const attachLocalStoreForwarder = (target: TLStore): (() => void) => {
    return target.listen((entry: HistoryEntry<TLRecord>) => {
      try {
        const counts = {
          added: Object.keys(entry.changes.added).length,
          updated: Object.keys(entry.changes.updated).length,
          removed: Object.keys(entry.changes.removed).length,
        };
        const total = counts.added + counts.updated + counts.removed;
        if (total === 0) return;
        if (entry.source !== 'user') {
          if (import.meta.env?.DEV) {
            console.debug('[whiteboard] skipping non-user entry', {
              source: entry.source,
              ...counts,
            });
          }
          return;
        }
        if (import.meta.env?.DEV) {
          console.debug('[whiteboard] local→Yjs', counts);
        }
        applyHistoryEntryToYMap(entry, yRecords, (apply) => doc.transact(apply, localOrigin));
      } catch (error) {
        console.error('[whiteboard] local→Yjs handler threw', error);
      }
    });
  };

  // Yjs -> local store: apply remote-origin map changes back to the store.
  const onYRecordsChange = (event: Y.YMapEvent<TLRecord>, transaction: Y.Transaction) => {
    try {
      if (transaction.origin === localOrigin) return;
      const toPut: TLRecord[] = [];
      const toRemove: TLRecord['id'][] = [];
      event.changes.keys.forEach((change, key) => {
        if (change.action === 'delete') {
          toRemove.push(key as TLRecord['id']);
        } else {
          const record = yRecords.get(key);
          if (isTldrawRecord(record, key)) {
            toPut.push(record);
          }
        }
      });
      if (import.meta.env?.DEV) {
        console.debug('[whiteboard] Yjs→local', {
          put: toPut.length,
          remove: toRemove.length,
        });
      }
      store.mergeRemoteChanges(() => {
        if (toRemove.length > 0) {
          try {
            store.remove(toRemove);
          } catch (error) {
            if (import.meta.env?.DEV) {
              console.warn('[whiteboard] failed to remove records', toRemove, error);
            }
          }
        }
        // Per-record put so one validation failure doesn't drop the whole
        // batch. Multiple retry passes resolve deeper dependency chains
        // (binding -> shape -> page) when records arrive out-of-order in a
        // single sync update.
        if (toPut.length > 0) {
          let pending = toPut;
          for (let pass = 0; pass < MAX_HYDRATION_PASSES && pending.length > 0; pass++) {
            const failed = applyRecordsResilient(store, pending);
            if (failed.length === pending.length) break;
            pending = failed;
          }
        }
      });
    } catch (error) {
      console.error('[whiteboard] Yjs→local handler threw', error);
    }
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
    attachLocalStoreForwarder,
    dispose: () => {
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
  // Wrapped TLStoreWithStatus is what tldraw expects for collaborative
  // sessions. Passing a raw TLStore makes tldraw assume the store is local
  // and suppresses emission of user-source change events that we rely on
  // to forward strokes to Yjs.
  storeWithStatus: TLStoreWithStatus;
  undoManager: Y.UndoManager;
  status: WhiteboardConnectionStatus;
  // Attach the local-store -> Yjs forwarder to whichever store the editor
  // actually uses (call this from <Tldraw onMount>). The returned function
  // detaches the listener; call it from your onMount cleanup.
  attachLocalStoreForwarder: (target: TLStore) => () => void;
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

  // Tldraw's collaboration mode wants to see status transition from
  // 'loading' to 'synced-remote' rather than start in 'synced-remote' —
  // some internal init paths only run on the transition. Start with
  // 'loading' on mount and flip on the next tick once Tldraw has had a
  // chance to register its observers.
  const [storeWithStatus, setStoreWithStatus] = useState<TLStoreWithStatus>({
    status: 'loading',
  });

  useEffect(() => {
    setStoreWithStatus({
      status: 'loading',
    });
    // Flip on next tick so React commits the loading state first, then
    // transitions to synced-remote on the next render. This matches the
    // official @tldraw/sync pattern.
    const handle = setTimeout(() => {
      setStoreWithStatus({
        status: 'synced-remote',
        connectionStatus: 'online',
        store: result.store,
      });
    }, 0);
    return () => clearTimeout(handle);
  }, [result.store]);

  return {
    storeWithStatus,
    undoManager: result.undoManager,
    status,
    attachLocalStoreForwarder: result.attachLocalStoreForwarder,
  };
}
