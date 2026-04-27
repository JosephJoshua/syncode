import { CONTROL_API, type WhiteboardAssetUploadUrlResponse } from '@syncode/contracts';
import {
  isWhiteboardContentType,
  type WhiteboardAllowedContentType,
  type WhiteboardLayer,
} from '@syncode/shared';
import { Button, cn } from '@syncode/ui';
import { Highlighter, PencilLine, Redo2, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type Editor,
  type TLAssetStore,
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

  const { store, undoManager } = useYjsTldrawStore({
    doc,
    awareness,
    assetStore,
    userId,
    userName,
    userColor,
    getLayer: () => layerRef.current,
  });

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
  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;
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
                onClick={() => setCurrentLayer('drawing')}
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
                onClick={() => setCurrentLayer('annotation')}
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
        </div>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <Tldraw
          store={store}
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
        <WhiteboardAuthorLegend
          store={store}
          participantNames={participantNames}
          hiddenAuthors={hiddenAuthors}
          onToggleAuthor={handleToggleAuthor}
          showAnnotations={showAnnotations}
          onToggleAnnotations={() => setShowAnnotations((v) => !v)}
        />
      </div>
    </div>
  );
}

// Mounts inside the tldraw context so it can use useEditor/useValue. Watches
// the relevant filter inputs and toggles each shape's `isLocked` + opacity to
// achieve a client-local hide effect without writing the preference into Yjs.
function VisibilityFilter({
  showAnnotations,
  hiddenAuthors,
}: {
  showAnnotations: boolean;
  hiddenAuthors: ReadonlySet<string>;
}) {
  const editor = useEditor();

  const ids = useValue('whiteboard-shape-ids', () => editor.getCurrentPageShapeIds(), [editor]);

  useEffect(() => {
    const updates: Array<{ id: TLShapeId; opacity: number }> = [];
    ids.forEach((id: TLShapeId) => {
      const shape = editor.getShape(id);
      if (!shape) return;
      const meta = (shape.meta ?? {}) as { layer?: 'drawing' | 'annotation'; authorId?: string };
      const hideForLayer = meta.layer === 'annotation' && !showAnnotations;
      const hideForAuthor = meta.authorId ? hiddenAuthors.has(meta.authorId) : false;
      const targetOpacity = hideForLayer || hideForAuthor ? 0 : 1;
      if (shape.opacity !== targetOpacity) {
        updates.push({ id, opacity: targetOpacity });
      }
    });
    if (updates.length === 0) return;
    editor.run(
      () => {
        for (const u of updates) {
          const shape = editor.getShape(u.id);
          if (shape) editor.updateShape({ id: u.id, type: shape.type, opacity: u.opacity });
        }
      },
      { history: 'ignore', ignoreShapeLock: true },
    );
  }, [editor, ids, showAnnotations, hiddenAuthors]);

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
