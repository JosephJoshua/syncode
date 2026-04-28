import { Button } from '@syncode/ui';
import { GripHorizontal, Maximize2, Minimize2, PanelRightClose } from 'lucide-react';
import { motion, useMotionValue, useSpring } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  clampPosition as clampPositionFor,
  clampSize as clampSizeFor,
  computeResizeFromCorner,
  FLOATING_EDGE_PADDING,
  type PersistedGeom,
  type ResizeCorner,
  readGeom,
  writeGeom,
} from '@/lib/floating-panel-geometry.js';

const SPRING_CONFIG = { stiffness: 300, damping: 30 };
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

  const posRef = useRef({ x: initial.x, y: initial.y });
  const springX = useMotionValue(initial.x < 0 ? 0 : initial.x);
  const springY = useMotionValue(initial.y < 0 ? 0 : initial.y);
  const animatedX = useSpring(springX, SPRING_CONFIG);
  const animatedY = useSpring(springY, SPRING_CONFIG);
  const didInitPosRef = useRef(false);

  const [size, setSize] = useState({ width: initial.width, height: initial.height });
  const [isMinimized, setIsMinimized] = useState(false);

  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const resizeRef = useRef<{
    corner: ResizeCorner;
    startX: number;
    startY: number;
    originWidth: number;
    originHeight: number;
    originPosX: number;
    originPosY: number;
  } | null>(null);
  const pendingResizeRef = useRef<{
    width: number;
    height: number;
    x: number;
    y: number;
  } | null>(null);
  const resizeRafRef = useRef<number | null>(null);

  const panelWidth = size.width;
  const panelHeight = isMinimized ? FLOATING_HEADER_HEIGHT : size.height;

  const clampPositionRef = useRef<((x: number, y: number) => { x: number; y: number }) | null>(
    null,
  );

  const clampPosition = useCallback(
    (x: number, y: number) =>
      clampPositionFor(x, y, panelWidth, panelHeight, window.innerWidth, window.innerHeight),
    [panelWidth, panelHeight],
  );
  clampPositionRef.current = clampPosition;

  const clampSize = useCallback(
    (width: number, height: number) =>
      clampSizeFor(width, height, window.innerWidth, window.innerHeight),
    [],
  );

  // Initial positioning: if no saved geometry, place near top-right; otherwise
  // re-clamp the saved position against the current viewport size.
  useEffect(() => {
    if (didInitPosRef.current) return;
    didInitPosRef.current = true;
    const fallbackX = Math.max(
      FLOATING_EDGE_PADDING,
      window.innerWidth - FLOATING_DEFAULT_WIDTH - FLOATING_EDGE_PADDING,
    );
    const fallbackY = FLOATING_EDGE_PADDING + 64;
    const startX = initial.x < 0 ? fallbackX : initial.x;
    const startY = initial.y < 0 ? fallbackY : initial.y;
    const clamped = clampPosition(startX, startY);
    posRef.current = clamped;
    springX.jump(clamped.x);
    springY.jump(clamped.y);
  }, [initial.x, initial.y, clampPosition, springX, springY]);

  // Re-clamp when the viewport resizes so the panel stays on-screen.
  useEffect(() => {
    const onResize = () => {
      const fn = clampPositionRef.current;
      if (!fn) return;
      const clamped = fn(posRef.current.x, posRef.current.y);
      posRef.current = clamped;
      springX.set(clamped.x);
      springY.set(clamped.y);
      setSize((prev) => clampSize(prev.width, prev.height));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [springX, springY, clampSize]);

  // Persist geometry whenever the panel size or final dragged position changes.
  useEffect(() => {
    writeGeom(storageKey, {
      x: posRef.current.x,
      y: posRef.current.y,
      width: size.width,
      height: size.height,
    });
  }, [storageKey, size.width, size.height]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: posRef.current.x,
      originY: posRef.current.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const clamped = clampPosition(dragRef.current.originX + dx, dragRef.current.originY + dy);
      posRef.current = clamped;
      springX.set(clamped.x);
      springY.set(clamped.y);
    },
    [clampPosition, springX, springY],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      dragRef.current = null;
      writeGeom(storageKey, {
        x: posRef.current.x,
        y: posRef.current.y,
        width: size.width,
        height: size.height,
      });
      // Match endResize: explicitly release pointer capture so the next
      // pointerdown isn't routed to the stale dragger that captured it.
      const target = e.target as HTMLElement;
      if (target.hasPointerCapture?.(e.pointerId)) {
        target.releasePointerCapture(e.pointerId);
      }
    },
    [storageKey, size.width, size.height],
  );

  const startResize = useCallback(
    (corner: ResizeCorner) => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizeRef.current = {
        corner,
        startX: e.clientX,
        startY: e.clientY,
        originWidth: size.width,
        originHeight: size.height,
        originPosX: posRef.current.x,
        originPosY: posRef.current.y,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [size.width, size.height],
  );

  const onResizePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const r = resizeRef.current;
      if (!r) return;
      const dx = e.clientX - r.startX;
      const dy = e.clientY - r.startY;

      const { rawWidth, rawHeight, rawX, rawY } = computeResizeFromCorner(
        r.corner,
        { width: r.originWidth, height: r.originHeight, x: r.originPosX, y: r.originPosY },
        dx,
        dy,
      );

      const clampedSize = clampSize(rawWidth, rawHeight);

      let nextX = rawX;
      let nextY = rawY;
      if (r.corner === 'tr' || r.corner === 'tl') {
        nextY = r.originPosY + (r.originHeight - clampedSize.height);
      }
      if (r.corner === 'bl' || r.corner === 'tl') {
        nextX = r.originPosX + (r.originWidth - clampedSize.width);
      }

      const clampedPos = clampPosition(nextX, nextY);

      pendingResizeRef.current = {
        width: clampedSize.width,
        height: clampedSize.height,
        x: clampedPos.x,
        y: clampedPos.y,
      };
      if (resizeRafRef.current !== null) return;
      resizeRafRef.current = requestAnimationFrame(() => {
        resizeRafRef.current = null;
        const pending = pendingResizeRef.current;
        if (!pending) return;
        setSize({ width: pending.width, height: pending.height });
        posRef.current = { x: pending.x, y: pending.y };
        springX.set(pending.x);
        springY.set(pending.y);
      });
    },
    [clampSize, clampPosition, springX, springY],
  );

  const endResize = useCallback(
    (e?: React.PointerEvent) => {
      resizeRef.current = null;
      if (resizeRafRef.current !== null) {
        cancelAnimationFrame(resizeRafRef.current);
        resizeRafRef.current = null;
      }
      const pending = pendingResizeRef.current;
      if (pending) {
        setSize({ width: pending.width, height: pending.height });
        posRef.current = { x: pending.x, y: pending.y };
        springX.set(pending.x);
        springY.set(pending.y);
        pendingResizeRef.current = null;
      }
      if (e) {
        const target = e.target as HTMLElement;
        if (target.hasPointerCapture?.(e.pointerId)) {
          target.releasePointerCapture(e.pointerId);
        }
      }
    },
    [springX, springY],
  );

  useEffect(() => {
    return () => {
      if (resizeRafRef.current !== null) cancelAnimationFrame(resizeRafRef.current);
    };
  }, []);

  const showResize = !isMinimized;

  return (
    <motion.div
      data-testid="floating-whiteboard-panel"
      className="fixed z-50 select-none"
      style={{
        left: animatedX,
        top: animatedY,
        width: panelWidth,
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
          <>
            <button
              type="button"
              tabIndex={-1}
              aria-label={t('whiteboard.resizeFromTopLeft')}
              className="group/resize absolute left-0 top-0 z-10 size-3 cursor-nwse-resize bg-transparent p-0"
              onPointerDown={startResize('tl')}
              onPointerMove={onResizePointerMove}
              onPointerUp={endResize}
              onPointerCancel={endResize}
              onLostPointerCapture={endResize}
            >
              <span className="pointer-events-none absolute left-0.5 top-0.5 block size-1.5 rounded-sm bg-muted-foreground/0 transition-colors group-hover/resize:bg-muted-foreground/40" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label={t('whiteboard.resizeFromTopRight')}
              className="group/resize absolute right-0 top-0 z-10 size-3 cursor-nesw-resize bg-transparent p-0"
              onPointerDown={startResize('tr')}
              onPointerMove={onResizePointerMove}
              onPointerUp={endResize}
              onPointerCancel={endResize}
              onLostPointerCapture={endResize}
            >
              <span className="pointer-events-none absolute right-0.5 top-0.5 block size-1.5 rounded-sm bg-muted-foreground/0 transition-colors group-hover/resize:bg-muted-foreground/40" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label={t('whiteboard.resizeFromBottomLeft')}
              className="group/resize absolute bottom-0 left-0 z-10 size-3 cursor-nesw-resize bg-transparent p-0"
              onPointerDown={startResize('bl')}
              onPointerMove={onResizePointerMove}
              onPointerUp={endResize}
              onPointerCancel={endResize}
              onLostPointerCapture={endResize}
            >
              <span className="pointer-events-none absolute bottom-0.5 left-0.5 block size-1.5 rounded-sm bg-muted-foreground/0 transition-colors group-hover/resize:bg-muted-foreground/40" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label={t('whiteboard.resizeFromBottomRight')}
              className="group/resize absolute bottom-0 right-0 z-10 flex size-4 cursor-nwse-resize items-end justify-end bg-transparent p-0 text-muted-foreground/50 hover:text-muted-foreground"
              onPointerDown={startResize('br')}
              onPointerMove={onResizePointerMove}
              onPointerUp={endResize}
              onPointerCancel={endResize}
              onLostPointerCapture={endResize}
            >
              <svg viewBox="0 0 10 10" className="size-2.5 pointer-events-none">
                <title>Resize</title>
                <path
                  d="M1 9 L9 9 M4 9 L9 4 M7 9 L9 7"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </button>
          </>
        ) : null}
      </div>
    </motion.div>
  );
}
