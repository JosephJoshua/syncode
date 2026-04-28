import { CONTROL_API, type WhiteboardAssetUploadUrlResponse } from '@syncode/contracts';
import {
  isWhiteboardContentType,
  type WhiteboardAllowedContentType,
  type WhiteboardLayer,
} from '@syncode/shared';
import { Button, cn } from '@syncode/ui';
import {
  Highlighter,
  PanelRightClose,
  PanelRightOpen,
  PencilLine,
  Redo2,
  Undo2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type Editor,
  type TLAssetStore,
  type TLShape,
  type TLShapeId,
  Tldraw,
  useEditor,
  useValue,
} from 'tldraw';
import 'tldraw/tldraw.css';
import type { Awareness } from 'y-protocols/awareness';
import type * as Y from 'yjs';
import { api } from '@/lib/api-client.js';
import { useYjsTldrawStore } from '@/lib/yjs-tldraw-store.js';
import { WhiteboardAuthorLegend } from './whiteboard-author-legend.js';

export interface RoomWhiteboardPanelProps {
  doc: Y.Doc;
  awareness: Awareness;
  roomId: string;
  userId: string;
  userName: string;
  userColor: string;
  canDraw: boolean;
  canAnnotate: boolean;
  participantNames: Map<string, string>;
  // Provided when the panel is currently docked in the tab area; clicking it
  // pops the whiteboard out into a floating PiP window so the user can draw
  // and watch the code editor side-by-side.
  onPopOut?: () => void;
  // Provided when the panel is currently rendered inside the floating
  // window; clicking it docks the whiteboard back into the workspace tab.
  onDock?: () => void;
}

const VISIBILITY_PREFIX = 'whiteboard:visibility';

function readVisibilityPrefs(
  roomId: string,
  userId: string,
): {
  showAnnotations: boolean;
  hiddenAuthors: string[];
} {
  if (typeof window === 'undefined') {
    return { showAnnotations: true, hiddenAuthors: [] };
  }
  try {
    const raw = window.localStorage.getItem(`${VISIBILITY_PREFIX}:${roomId}:${userId}`);
    if (!raw) return { showAnnotations: true, hiddenAuthors: [] };
    const parsed = JSON.parse(raw) as Partial<{
      showAnnotations: boolean;
      hiddenAuthors: string[];
    }>;
    return {
      showAnnotations: parsed.showAnnotations ?? true,
      hiddenAuthors: Array.isArray(parsed.hiddenAuthors) ? parsed.hiddenAuthors : [],
    };
  } catch {
    return { showAnnotations: true, hiddenAuthors: [] };
  }
}

function writeVisibilityPrefs(
  roomId: string,
  userId: string,
  prefs: { showAnnotations: boolean; hiddenAuthors: string[] },
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${VISIBILITY_PREFIX}:${roomId}:${userId}`, JSON.stringify(prefs));
  } catch {
    // Quota / SSR / private mode — ignore.
  }
}

export function RoomWhiteboardPanel({
  doc,
  awareness,
  roomId,
  userId,
  userName,
  userColor,
  canDraw,
  canAnnotate,
  participantNames,
  onPopOut,
  onDock,
}: RoomWhiteboardPanelProps) {
  const { t } = useTranslation('rooms');

  const initialPrefs = useMemo(() => readVisibilityPrefs(roomId, userId), [roomId, userId]);
  const [showAnnotations, setShowAnnotations] = useState(initialPrefs.showAnnotations);
  const [hiddenAuthors, setHiddenAuthors] = useState<Set<string>>(
    () => new Set(initialPrefs.hiddenAuthors),
  );
  const initialLayer: WhiteboardLayer = canDraw ? 'drawing' : 'annotation';
  const [currentLayer, setCurrentLayer] = useState<WhiteboardLayer>(initialLayer);
  const layerRef = useRef<WhiteboardLayer>(initialLayer);
  layerRef.current = currentLayer;

  // Persist visibility preferences whenever they change.
  useEffect(() => {
    writeVisibilityPrefs(roomId, userId, {
      showAnnotations,
      hiddenAuthors: Array.from(hiddenAuthors),
    });
  }, [roomId, userId, showAnnotations, hiddenAuthors]);

  const assetStore = useMemo<TLAssetStore>(() => createControlPlaneAssetStore(roomId), [roomId]);

  const { storeWithStatus, undoManager, attachLocalStoreForwarder } = useYjsTldrawStore({
    doc,
    awareness,
    assetStore,
    userId,
    userName,
    userColor,
    getLayer: () => layerRef.current,
  });
  const store = storeWithStatus.status === 'synced-remote' ? storeWithStatus.store : null;

  const handleToggleAuthor = useCallback((authorId: string) => {
    setHiddenAuthors((prev) => {
      const next = new Set(prev);
      if (next.has(authorId)) {
        next.delete(authorId);
      } else {
        next.add(authorId);
      }
      return next;
    });
  }, []);

  const editorRef = useRef<Editor | null>(null);
  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;

      // Expose for ad-hoc browser-console debugging in dev only.
      if (import.meta.env?.DEV && typeof window !== 'undefined') {
        (window as unknown as { __whiteboardEditor?: Editor }).__whiteboardEditor = editor;
      }

      // Wire the local-store -> Yjs forwarder onto the editor's actual store.
      // Tldraw 4.5 wraps the TLStoreWithStatus.store internally, so the
      // editor.store object exposed here is what emits user-source change
      // events — pre-attaching a listener to our pre-created store would
      // miss every stroke (the symptom the user diagnostics surfaced).
      const unsubLocalForwarder = attachLocalStoreForwarder(editor.store);

      // After hydration, hop to whichever page actually has shapes. tldraw's
      // createTLStore creates a default page with id 'page:page', but a
      // synced doc may carry a page record with a different id (when the
      // first writer or a previous session generated one). The local default
      // page would still be the active one, leaving the editor showing an
      // empty canvas while all shapes sit on the hydrated page.
      const switchToPopulatedPage = () => {
        const pages = editor.getPages();
        if (pages.length === 0) return;
        const currentId = editor.getCurrentPageId();
        let bestId = currentId;
        let bestCount = editor.getPageShapeIds(currentId).size;
        for (const page of pages) {
          if (page.id === currentId) continue;
          const count = editor.getPageShapeIds(page.id).size;
          if (count > bestCount) {
            bestId = page.id;
            bestCount = count;
          }
        }
        if (bestId !== currentId) {
          if (import.meta.env?.DEV) {
            console.debug('[whiteboard] switching active page', {
              from: currentId,
              to: bestId,
              shapeCount: bestCount,
            });
          }
          editor.setCurrentPage(bestId);
        }
      };
      // Run after the current microtask settles so initial hydration has a
      // chance to place every record before we count.
      queueMicrotask(switchToPopulatedPage);

      // (A + C) For locally-authored annotation shapes:
      //   - Force props.color = 'orange' for an immediate, unmissable visual
      //     contrast against drawings that use whatever color the author
      //     chose. The override propagates to peers via Yjs so every client
      //     sees annotations in the same accent color.
      //   - Force props.dash = 'dashed' on shape types that support it
      //     (geo, arrow, line) so the boundary reads as 'commentary' rather
      //     than 'content'.
      //   - bringToFront so annotations always render on top of drawings.
      // Source==='user' filter ensures only the author runs these mutations;
      // every peer just reflects the resulting record once it lands.
      const cleanup = editor.store.sideEffects.registerAfterCreateHandler(
        'shape',
        (shape, source) => {
          if (source !== 'user') return;
          const meta = shape.meta as { layer?: 'drawing' | 'annotation' };
          if (meta.layer !== 'annotation') return;
          queueMicrotask(() => {
            const current = editor.getShape(shape.id);
            if (!current) return;
            const props = current.props as Record<string, unknown>;
            const next: Record<string, unknown> = {};
            if ('color' in props) next.color = 'orange';
            if ('dash' in props) next.dash = 'dashed';
            if (Object.keys(next).length > 0) {
              editor.updateShape({
                id: shape.id,
                type: shape.type,
                props: next,
              });
            }
            editor.bringToFront([shape.id]);
          });
        },
      );
      return () => {
        cleanup();
        unsubLocalForwarder();
      };
    },
    [attachLocalStoreForwarder],
  );

  // (D) Switch the active tldraw tool when the user toggles layer mode.
  // Drawing -> freehand draw tool; Annotation -> highlighter (visually
  // distinct + obvious 'review pen' affordance).
  const handleSelectLayer = useCallback((layer: WhiteboardLayer) => {
    setCurrentLayer(layer);
    layerRef.current = layer;
    const editor = editorRef.current;
    if (!editor) return;
    editor.setCurrentTool(layer === 'annotation' ? 'highlight' : 'draw');
  }, []);

  const showLayerToggle = canDraw && canAnnotate;

  return (
    <div className="relative flex h-full flex-col bg-background">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border bg-card px-3">
        <div className="flex items-center gap-2">
          {showLayerToggle ? (
            <div
              role="radiogroup"
              aria-label={t('whiteboard.layer')}
              className="flex h-7 items-center rounded-md border border-border bg-background p-0.5"
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                role="radio"
                aria-checked={currentLayer === 'drawing'}
                onClick={() => handleSelectLayer('drawing')}
                className={cn(
                  'h-6 gap-1 px-2 text-[11px]',
                  currentLayer === 'drawing'
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground',
                )}
              >
                <PencilLine className="size-3" />
                {t('whiteboard.layerDrawing')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                role="radio"
                aria-checked={currentLayer === 'annotation'}
                onClick={() => handleSelectLayer('annotation')}
                className={cn(
                  'h-6 gap-1 px-2 text-[11px]',
                  currentLayer === 'annotation'
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground',
                )}
              >
                <Highlighter className="size-3" />
                {t('whiteboard.layerAnnotation')}
              </Button>
            </div>
          ) : (
            <div className="flex h-7 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-[11px] text-muted-foreground">
              <Highlighter className="size-3" />
              <span>{t('whiteboard.annotatingAs', { name: userName })}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => undoManager.undo()}
            aria-label={t('whiteboard.undo')}
            className="h-6 w-6"
          >
            <Undo2 className="size-3" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => undoManager.redo()}
            aria-label={t('whiteboard.redo')}
            className="h-6 w-6"
          >
            <Redo2 className="size-3" />
          </Button>
          {onPopOut ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onPopOut}
              aria-label={t('whiteboard.popOut')}
              className="h-6 w-6"
            >
              <PanelRightOpen className="size-3" />
            </Button>
          ) : null}
          {onDock ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onDock}
              aria-label={t('whiteboard.dockBack')}
              className="h-6 w-6"
            >
              <PanelRightClose className="size-3" />
            </Button>
          ) : null}
        </div>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <Tldraw
          store={storeWithStatus}
          onMount={handleMount}
          components={{
            // The default page menu, main menu, and document name aren't
            // useful inside an embedded interview surface; we replace them
            // with our own toolbar controls above.
            PageMenu: null,
            MainMenu: null,
            DebugMenu: null,
            HelpMenu: null,
          }}
        >
          <VisibilityFilter showAnnotations={showAnnotations} hiddenAuthors={hiddenAuthors} />
        </Tldraw>
        {store ? (
          <WhiteboardAuthorLegend
            store={store}
            participantNames={participantNames}
            hiddenAuthors={hiddenAuthors}
            onToggleAuthor={handleToggleAuthor}
            showAnnotations={showAnnotations}
            onToggleAnnotations={() => setShowAnnotations((v) => !v)}
          />
        ) : null}
      </div>
    </div>
  );
}

// Annotations render at a lower opacity than drawings AND in a fixed accent
// color (set in the after-create handler). The combination — translucent +
// orange — makes annotations read unambiguously as "commentary" without
// hiding them entirely. Drawings stay at full opacity in whatever color the
// author chose.
const ANNOTATION_TINT_OPACITY = 0.55;
const DRAWING_OPACITY = 1;
const HIDDEN_OPACITY = 0;

// Reactive overlay that maintains a client-local opacity for every shape
// based on the layer toggle and per-author filter. The mutation runs inside
// store.mergeRemoteChanges so the user-source listener that bridges to Yjs
// skips it — the visibility preference never escapes this client.
//
// (A) Annotation tint: visible annotations render at reduced opacity so
// reviewer feedback is instantly recognizable without being hidden, while
// drawings stay at full opacity.
function VisibilityFilter({
  showAnnotations,
  hiddenAuthors,
}: {
  showAnnotations: boolean;
  hiddenAuthors: ReadonlySet<string>;
}) {
  const editor = useEditor();

  // Subscribe to the actual shape records — opacity must be re-applied
  // whenever a peer updates a shape (a remote update arrives carrying
  // opacity=1 from the wire), not only when the id set changes.
  const shapesNeedingUpdate = useValue('whiteboard-shapes-with-meta', () => {
    const ids = editor.getCurrentPageShapeIds();
    const result: Array<{ id: TLShapeId; targetOpacity: number }> = [];
    ids.forEach((id: TLShapeId) => {
      const shape = editor.getShape(id);
      if (!shape) return;
      const meta = (shape.meta ?? {}) as { layer?: 'drawing' | 'annotation'; authorId?: string };
      const hideForLayer = meta.layer === 'annotation' && !showAnnotations;
      const hideForAuthor = meta.authorId ? hiddenAuthors.has(meta.authorId) : false;
      const target =
        hideForLayer || hideForAuthor
          ? HIDDEN_OPACITY
          : meta.layer === 'annotation'
            ? ANNOTATION_TINT_OPACITY
            : DRAWING_OPACITY;
      if (shape.opacity !== target) {
        result.push({ id, targetOpacity: target });
      }
    });
    return result;
  }, [editor, showAnnotations, hiddenAuthors]);

  useEffect(() => {
    if (shapesNeedingUpdate.length === 0) return;
    // Direct store.put inside mergeRemoteChanges. Going through editor.run
    // or editor.updateShape can register the change as a 'user' edit on
    // certain code paths, which would leak the local opacity into Yjs and
    // ricochet between peers. Direct store.put is the only API guaranteed
    // to respect the mergeRemoteChanges 'remote' source flag.
    editor.store.mergeRemoteChanges(() => {
      const updated: TLShape[] = [];
      for (const u of shapesNeedingUpdate) {
        const current = editor.store.get(u.id) as TLShape | undefined;
        if (!current) continue;
        if (current.opacity === u.targetOpacity) continue;
        updated.push({ ...current, opacity: u.targetOpacity });
      }
      if (updated.length > 0) editor.store.put(updated);
    });
  }, [editor, shapesNeedingUpdate]);

  return null;
}

function createControlPlaneAssetStore(roomId: string): TLAssetStore {
  return {
    async upload(_asset, file) {
      const contentType = file.type;
      if (!isWhiteboardContentType(contentType)) {
        throw new Error(
          `Unsupported asset content type "${contentType}". Allowed: PNG, JPEG, WebP, GIF, SVG, MP4, WebM.`,
        );
      }
      const presigned: WhiteboardAssetUploadUrlResponse = await api(
        CONTROL_API.WHITEBOARD_ASSETS.UPLOAD_URL,
        {
          params: { id: roomId },
          body: {
            filename: file.name,
            contentType: contentType as WhiteboardAllowedContentType,
            contentLength: file.size,
          },
        },
      );

      const putResponse = await fetch(presigned.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': contentType },
      });
      if (!putResponse.ok) {
        throw new Error(
          `Failed to upload whiteboard asset to storage (${putResponse.status} ${putResponse.statusText})`,
        );
      }
      return { src: presigned.downloadUrl, meta: { storageKey: presigned.key } };
    },
    resolve(asset) {
      return asset.props.src ?? null;
    },
  };
}
