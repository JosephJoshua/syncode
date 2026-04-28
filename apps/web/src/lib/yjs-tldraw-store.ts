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
  // Tell the binding which store to mutate when remote Yjs updates arrive.
  // Tldraw 4.5's <Tldraw store={...}> wraps the provided store, so the
  // editor.store visible from onMount is a DIFFERENT object than the one
  // we passed in. Without this redirection, Yjs->local writes would land
  // on the original store while the editor renders from the wrapped one,
  // leaving incoming remote shapes invisible.
  setLocalApplyTarget: (target: TLStore | null) => void;
}

// Cap mass-create flushes so a paste of hundreds of shapes doesn't lock the
// main thread. Each transaction batches up to this many record writes; further
// writes spill into subsequent transactions but still preserve ordering.
const MAX_BATCH_PER_TRANSACTION = 256;

// tldraw record types that are part of the SHARED document state and should
// be replicated through Yjs to every peer. Everything else (camera, pointer,
// instance state, page state, presence) is per-client session state and must
// stay local — replicating it would create a feedback loop because tldraw
// mutates session records on every render tick.
const DOCUMENT_RECORD_TYPES = new Set(['shape', 'asset', 'page', 'document', 'binding']);

const isDocumentRecord = (record: { typeName: string }): boolean =>
  DOCUMENT_RECORD_TYPES.has(record.typeName);

const collectTypeNames = (entry: HistoryEntry<TLRecord>): string[] => {
  const set = new Set<string>();
  for (const r of Object.values(entry.changes.added)) set.add((r as { typeName: string }).typeName);
  for (const [, [before, after]] of Object.entries(entry.changes.updated)) {
    const r = (after ?? before) as { typeName: string } | undefined;
    if (r) set.add(r.typeName);
  }
  for (const r of Object.values(entry.changes.removed)) {
    set.add((r as { typeName: string }).typeName);
  }
  return Array.from(set);
};

// Tally only document-scoped records in a HistoryEntry. Session/presence
// records are excluded so noisy camera/pointer churn doesn't spam the
// diagnostic log or trigger empty Yjs forwards.
const countDocumentRecords = (
  entry: HistoryEntry<TLRecord>,
): { added: number; updated: number; removed: number; total: number } => {
  let added = 0;
  let updated = 0;
  let removed = 0;
  for (const record of Object.values(entry.changes.added)) {
    if (isDocumentRecord(record as { typeName: string })) added += 1;
  }
  for (const [, [before, after]] of Object.entries(entry.changes.updated)) {
    const r = (after ?? before) as { typeName: string } | undefined;
    if (r && isDocumentRecord(r)) updated += 1;
  }
  for (const record of Object.values(entry.changes.removed)) {
    if (isDocumentRecord(record as { typeName: string })) removed += 1;
  }
  return { added, updated, removed, total: added + updated + removed };
};

// Defensive runtime guard: only objects with a string id and typeName
// (matching tldraw's record shape) are treated as records. Also filters out
// session/presence-scoped types (camera, pointer, instance) so we don't
// replicate per-client state into the shared doc, and rejects legacy Y.Map
// sub-instances or anything else that ended up in the whiteboard root by
// accident. Declared as a `const` arrow function so it's fully initialized
// by the time the closures inside createYjsTldrawStore reference it during
// HMR/bundler module evaluation.
const isTldrawRecord = (value: unknown, key: string): value is TLRecord => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { id?: unknown; typeName?: unknown };
  if (typeof candidate.id !== 'string' || typeof candidate.typeName !== 'string') return false;
  if (candidate.id !== key) return false;
  return DOCUMENT_RECORD_TYPES.has(candidate.typeName);
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
  let succeeded = 0;
  for (const record of records) {
    try {
      store.put([record]);
      succeeded++;
    } catch (error) {
      failed.push(record);
      if (import.meta.env?.DEV) {
        console.warn('[whiteboard] failed to apply record', record.id, error);
      }
    }
  }
  if (import.meta.env?.DEV && (succeeded > 0 || failed.length > 0)) {
    console.debug('[whiteboard] applyRecordsResilient', {
      total: records.length,
      succeeded,
      failed: failed.length,
      storeId: (store as { id?: string }).id,
    });
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

// Forward a tldraw HistoryEntry into the shared Y.Map. Skips any record
// that isn't part of the shared document (camera, pointer, instance state,
// presence) — replicating those would corrupt other clients with our local
// view state and create a feedback loop on every render tick. Sanitize each
// record via JSON round-trip so non-cloneable fields don't poison Yjs's
// internal structuredClone path. Each MAX_BATCH_PER_TRANSACTION-sized slice
// runs in its own transaction so a paste of hundreds of shapes doesn't lock
// the main thread inside one giant Yjs transaction.
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
    if (!isDocumentRecord(record as { typeName: string })) continue;
    const sanitized = sanitizeForYjs(normalizeShapeForYjs(record));
    if (sanitized) writes.push(() => yRecords.set(id, sanitized));
  }
  for (const [id, [before, after]] of Object.entries(entry.changes.updated)) {
    const next = (after ?? before) as { typeName: string };
    if (!isDocumentRecord(next)) continue;
    const sanitized = sanitizeForYjs(normalizeShapeForYjs(after));
    if (sanitized) writes.push(() => yRecords.set(id, sanitized));
  }
  for (const [id, removed] of Object.entries(entry.changes.removed)) {
    if (!isDocumentRecord(removed as { typeName: string })) continue;
    writes.push(() => yRecords.delete(id));
  }

  if (writes.length === 0) return;

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
    if (import.meta.env?.DEV) {
      console.debug('[whiteboard] forwarder attached', { storeId: (target as { id?: string }).id });
    }
    return target.listen((entry: HistoryEntry<TLRecord>) => {
      try {
        if (import.meta.env?.DEV) {
          // Log every entry the listener sees, including non-user ones, so
          // we can pinpoint where the bridge breaks if it stops working.
          const sample = {
            source: entry.source,
            added: Object.keys(entry.changes.added).length,
            updated: Object.keys(entry.changes.updated).length,
            removed: Object.keys(entry.changes.removed).length,
            // What types are in the entry — answers "is tldraw emitting
            // shape changes at all?"
            types: collectTypeNames(entry),
          };
          if (sample.added + sample.updated + sample.removed > 0) {
            console.debug('[whiteboard] forwarder saw entry', sample);
          }
        }
        if (entry.source !== 'user') return;
        // Pre-filter: tldraw emits user-source events for session-scoped
        // records (camera pan/zoom, pointer move, instance state) on every
        // render tick. Forwarding those would (a) corrupt peers with our
        // local view state and (b) create a feedback loop because the
        // round-trip through Yjs reads them back as remote updates.
        const docRecords = countDocumentRecords(entry);
        if (docRecords.total === 0) return;
        if (import.meta.env?.DEV) {
          console.debug('[whiteboard] local→Yjs', docRecords);
        }
        applyHistoryEntryToYMap(entry, yRecords, (apply) => doc.transact(apply, localOrigin));
      } catch (error) {
        console.error('[whiteboard] local→Yjs handler threw', error);
      }
    });
  };

  if (import.meta.env?.DEV) {
    console.debug('[whiteboard] result.store created', {
      storeId: (store as { id?: string }).id,
    });
  }

  // The store we mutate on Yjs->local. Defaults to the local result.store,
  // but the room-whiteboard-panel calls setLocalApplyTarget(editor.store)
  // from onMount so remote updates land on the store tldraw is actually
  // rendering. See setLocalApplyTarget below for the why.
  let applyTarget: TLStore = store;

  const setLocalApplyTarget = (target: TLStore | null): void => {
    if (import.meta.env?.DEV) {
      console.debug('[whiteboard] setLocalApplyTarget', {
        targetStoreId: target ? (target as { id?: string }).id : null,
        sameAsResultStore: target === store,
      });
    }
    applyTarget = target ?? store;
    // Always re-hydrate the new target with whatever's currently in the
    // Yjs map. Even when target === store (because tldraw passes the
    // original store through unchanged), repeating the hydration is
    // idempotent — store.put on an existing record with identical fields
    // is a no-op. This guarantees the editor sees every record that
    // arrived between construction and mount, regardless of which store
    // got the original write.
    if (target) {
      const records: TLRecord[] = [];
      yRecords.forEach((value, key) => {
        if (isTldrawRecord(value, key)) records.push(value);
      });
      if (records.length > 0) {
        if (import.meta.env?.DEV) {
          console.debug('[whiteboard] re-hydrating target', { count: records.length });
        }
        hydrateFromRemote(target, records);
      }
    }
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
          target: applyTarget === store ? 'pre-mount' : 'editor.store',
        });
      }
      applyTarget.mergeRemoteChanges(() => {
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
    setLocalApplyTarget,
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
  // Tell the binding which store to mutate on incoming Yjs updates. Pass
  // editor.store from onMount; pass null on unmount.
  setLocalApplyTarget: (target: TLStore | null) => void;
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

  // Mount tldraw straight into 'synced-remote' with our store. An earlier
  // attempt staged a loading -> synced-remote transition on the next tick,
  // but in practice tldraw didn't always finish wiring up the editor when
  // the store changed via setState — the symptom was a blank canvas on
  // initial load that only appeared after a hot reload (because HMR
  // re-evaluated with the store already cached). Starting at synced-remote
  // mounts the editor on its real store from the first render.
  const storeWithStatus = useMemo<TLStoreWithStatus>(
    () => ({
      status: 'synced-remote',
      connectionStatus: 'online',
      store: result.store,
    }),
    [result.store],
  );

  return {
    storeWithStatus,
    undoManager: result.undoManager,
    status,
    attachLocalStoreForwarder: result.attachLocalStoreForwarder,
    setLocalApplyTarget: result.setLocalApplyTarget,
  };
}
