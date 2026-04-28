import { Button } from '@syncode/ui';
import { GripHorizontal, Maximize2, Minimize2, PanelRightClose } from 'lucide-react';
import { motion } from 'motion/react';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFloatingPanel } from '@/hooks/use-floating-panel.js';
import {
  FLOATING_EDGE_PADDING,
  FLOATING_MIN_HEIGHT,
  FLOATING_MIN_WIDTH,
  type PersistedGeom,
  readGeom,
  writeGeom,
} from '@/lib/floating-panel-geometry.js';
import { PanelCornerGrips } from './panel-corner-grips.js';

const FLOATING_DEFAULT_WIDTH = 480;
const FLOATING_DEFAULT_HEIGHT = 360;
const FLOATING_HEADER_HEIGHT = 28;
const FLOATING_STORAGE_PREFIX = 'whiteboard:floating:geom';

interface FloatingWhiteboardPanelProps {
  // Stable identity for persisted geometry — we key per room+user so two
  // sessions on the same browser don't fight for the same saved position.
  readonly persistKey: string;
  readonly title: string;
  readonly onClose: () => void;
  // Receives the inner body element; the parent uses this to portal the
  // whiteboard subtree into it without remounting.
  readonly bodyRef: (node: HTMLDivElement | null) => void;
}

export function FloatingWhiteboardPanel({
  persistKey,
  title,
  onClose,
  bodyRef,
}: FloatingWhiteboardPanelProps) {
  const { t } = useTranslation('rooms');

  const storageKey = `${FLOATING_STORAGE_PREFIX}:${persistKey}`;

  const initial = useRef<PersistedGeom>(
    readGeom(storageKey) ?? {
      x: -1,
      y: -1,
      width: FLOATING_DEFAULT_WIDTH,
      height: FLOATING_DEFAULT_HEIGHT,
    },
  ).current;

  const [size, setSize] = useState({ width: initial.width, height: initial.height });
  const [isMinimized, setIsMinimized] = useState(false);

  const panelHeight = isMinimized ? FLOATING_HEADER_HEIGHT : size.height;

  const onCommit = useCallback(
    (geom: PersistedGeom) => {
      writeGeom(storageKey, geom);
    },
    [storageKey],
  );

  const getInitialPosition = useCallback(() => {
    const fallbackX = Math.max(
      FLOATING_EDGE_PADDING,
      window.innerWidth - FLOATING_DEFAULT_WIDTH - FLOATING_EDGE_PADDING,
    );
    const fallbackY = FLOATING_EDGE_PADDING + 64;
    return {
      x: initial.x < 0 ? fallbackX : initial.x,
      y: initial.y < 0 ? fallbackY : initial.y,
    };
  }, [initial.x, initial.y]);

  const {
    animatedX,
    animatedY,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    startResize,
    onResizePointerMove,
    endResize,
  } = useFloatingPanel({
    size,
    setSize,
    panelWidth: size.width,
    panelHeight,
    minWidth: FLOATING_MIN_WIDTH,
    minHeight: FLOATING_MIN_HEIGHT,
    getInitialPosition,
    onCommit,
  });

  const showResize = !isMinimized;

  return (
    <motion.div
      data-testid="floating-whiteboard-panel"
      className="fixed z-50 select-none"
      style={{
        left: animatedX,
        top: animatedY,
        width: size.width,
        height: panelHeight,
      }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card/95 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div
          className="flex h-7 shrink-0 cursor-grab items-center justify-between border-b border-border/40 bg-muted/40 px-2 active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <div className="flex items-center gap-1.5">
            <GripHorizontal className="size-2.5 text-muted-foreground/40" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/80">
              {title}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="size-4 text-muted-foreground/60 hover:text-foreground"
              onClick={() => setIsMinimized((v) => !v)}
              aria-label={
                isMinimized ? t('whiteboard.restoreFloating') : t('whiteboard.minimizeFloating')
              }
            >
              {isMinimized ? (
                <Maximize2 className="size-2.5" />
              ) : (
                <Minimize2 className="size-2.5" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="size-4 text-muted-foreground/60 hover:text-foreground"
              onClick={onClose}
              aria-label={t('whiteboard.dockToTab')}
            >
              <PanelRightClose className="size-2.5" />
            </Button>
          </div>
        </div>

        <div
          ref={bodyRef}
          // Hide the body when minimized so the whiteboard subtree stops
          // receiving pointer events without being unmounted; tldraw keeps
          // its editor state and snaps right back when restored.
          className={isMinimized ? 'hidden' : 'flex-1 min-h-0'}
        />

        {showResize ? (
          <PanelCornerGrips
            startResize={startResize}
            onResizePointerMove={onResizePointerMove}
            endResize={endResize}
            labels={{
              tl: t('whiteboard.resizeFromTopLeft'),
              tr: t('whiteboard.resizeFromTopRight'),
              bl: t('whiteboard.resizeFromBottomLeft'),
              br: t('whiteboard.resizeFromBottomRight'),
            }}
          />
        ) : null}
      </div>
    </motion.div>
  );
}
