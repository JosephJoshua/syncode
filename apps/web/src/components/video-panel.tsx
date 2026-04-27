import { Avatar, AvatarFallback, AvatarImage, Button, cn } from '@syncode/ui';
import {
  GripHorizontal,
  Maximize2,
  Minimize2,
  MonitorUp,
  PanelRight,
  PanelRightClose,
  Video,
} from 'lucide-react';
import { AnimatePresence, motion, useMotionValue, useSpring } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVideoTrack } from '@/hooks/use-video-track.js';

export interface VideoPanelParticipant {
  identity: string;
  displayName: string;
  avatarUrl: string | null;
  hasVideo: boolean;
  videoTrack: MediaStreamTrack | null;
  hasScreenShare: boolean;
  screenShareTrack: MediaStreamTrack | null;
  isSpeaking: boolean;
  isLocal: boolean;
}

interface ParticipantTileProps extends Omit<VideoPanelParticipant, 'identity'> {
  onZoom?: () => void;
  fit?: 'cover' | 'contain';
}

function ParticipantTile({
  displayName,
  avatarUrl,
  hasVideo,
  videoTrack,
  isSpeaking,
  isLocal,
  onZoom,
  fit = 'cover',
}: ParticipantTileProps) {
  const { t } = useTranslation('rooms');
  const videoRef = useVideoTrack(videoTrack);
  const initial = displayName.charAt(0).toUpperCase();
  const interactiveProps = useZoomInteractiveProps(onZoom);

  return (
    <div
      className={cn(
        'group relative aspect-video overflow-hidden rounded-lg bg-muted/80 transition-shadow duration-200',
        isSpeaking && 'ring-2 ring-emerald-400/70 shadow-[0_0_12px_-3px_oklch(0.75_0.18_155/0.4)]',
      )}
      {...interactiveProps}
    >
      {hasVideo && videoTrack ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            'h-full w-full',
            fit === 'contain' ? 'object-contain' : 'object-cover',
            isLocal && 'scale-x-[-1]',
          )}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-muted/60">
          <Avatar className="size-10">
            {avatarUrl ? <AvatarImage src={avatarUrl} /> : null}
            <AvatarFallback className="bg-primary/10 text-lg text-primary">
              {initial}
            </AvatarFallback>
          </Avatar>
        </div>
      )}

      {onZoom ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="absolute right-1 top-1 size-5 bg-black/40 text-white/80 opacity-0 backdrop-blur-sm hover:bg-black/60 hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onZoom();
          }}
          aria-label="Zoom in"
        >
          <Maximize2 className="size-3" />
        </Button>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent px-2 pb-1.5 pt-5">
        <div className="flex items-center gap-1.5">
          {isSpeaking ? (
            <span className="size-1.5 shrink-0 rounded-full bg-emerald-400 live-pulse" />
          ) : null}
          <span className="font-mono text-[10px] font-medium text-white/90 drop-shadow-sm">
            {displayName}
            {isLocal ? <span className="ml-1 text-white/60">{t('lobby.you')}</span> : null}
          </span>
        </div>
      </div>
    </div>
  );
}

interface ScreenShareTileProps {
  displayName: string;
  screenShareTrack: MediaStreamTrack;
  onZoom?: () => void;
  fill?: boolean;
}

function ScreenShareTile({
  displayName,
  screenShareTrack,
  onZoom,
  fill = false,
}: ScreenShareTileProps) {
  const videoRef = useVideoTrack(screenShareTrack);
  const interactiveProps = useZoomInteractiveProps(onZoom);

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-lg bg-black/95 ring-1 ring-primary/30',
        fill && 'h-full',
      )}
      {...interactiveProps}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={cn('w-full object-contain', fill && 'h-full')}
        style={fill ? undefined : { maxHeight: '40vh' }}
      />
      {onZoom ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="absolute right-1.5 top-1.5 size-6 bg-black/50 text-white/80 opacity-0 backdrop-blur-sm hover:bg-black/70 hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onZoom();
          }}
          aria-label="Zoom in"
        >
          <Maximize2 className="size-3" />
        </Button>
      ) : null}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-2 pt-5">
        <div className="flex items-center gap-1.5">
          <MonitorUp className="size-3 text-primary" />
          <span className="font-mono text-[10px] font-medium text-white/90 drop-shadow-sm">
            {displayName}
          </span>
        </div>
      </div>
    </div>
  );
}

export type ZoomTarget = { identity: string; kind: 'camera' | 'screen' };

export function shouldClearZoomTarget(
  zoomTarget: ZoomTarget | null,
  tiles: VideoPanelParticipant[],
): boolean {
  if (zoomTarget === null) return false;
  const stillPresent = tiles.some((t) => {
    if (t.identity !== zoomTarget.identity) return false;
    if (zoomTarget.kind === 'screen') return t.hasScreenShare && t.screenShareTrack !== null;
    return true;
  });
  return !stillPresent;
}

export function useClearZoomWhenMissing(
  zoomTarget: ZoomTarget | null,
  tiles: VideoPanelParticipant[],
  setZoomTarget: (target: ZoomTarget | null) => void,
) {
  useEffect(() => {
    if (shouldClearZoomTarget(zoomTarget, tiles)) setZoomTarget(null);
  }, [tiles, zoomTarget, setZoomTarget]);
}

function useZoomInteractiveProps(onZoom: (() => void) | undefined) {
  if (!onZoom) return undefined;
  return {
    role: 'button' as const,
    tabIndex: -1,
    onDoubleClick: (e: React.MouseEvent) => {
      e.preventDefault();
      onZoom();
    },
  };
}

interface ZoomOverlayProps {
  tile: VideoPanelParticipant;
  kind: 'camera' | 'screen';
  onClose: () => void;
}

function ZoomOverlay({ tile, kind, onClose }: ZoomOverlayProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    const previous = previouslyFocusedRef.current;
    return () => {
      if (previous && document.contains(previous)) previous.focus();
    };
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = overlayRef.current;
      if (!root) return;
      const focusable = root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) {
        e.preventDefault();
        root.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first === undefined || last === undefined) return;
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  const isScreen = kind === 'screen' && tile.hasScreenShare && tile.screenShareTrack;

  return (
    <motion.div
      ref={overlayRef}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm outline-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      role="dialog"
      aria-modal="true"
      aria-label="Zoomed video"
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        aria-label="Close zoom"
        className="absolute inset-0 cursor-default bg-transparent"
        onClick={onClose}
      />
      <div className="relative flex h-[96vh] w-[96vw] items-center justify-center">
        {isScreen && tile.screenShareTrack ? (
          <ScreenShareTile
            displayName={tile.displayName}
            screenShareTrack={tile.screenShareTrack}
            fill
          />
        ) : (
          <ParticipantTile {...tile} fit="contain" />
        )}
        <div className="absolute right-2 top-2 flex items-center gap-1">
          <Button
            ref={closeButtonRef}
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8 bg-black/50 text-white/90 backdrop-blur-sm hover:bg-black/70 hover:text-white"
            onClick={onClose}
            aria-label="Exit zoom"
          >
            <Minimize2 className="size-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function pickActiveTile(tiles: VideoPanelParticipant[]): VideoPanelParticipant | null {
  if (tiles.length === 0) return null;
  const screenSharer = tiles.find((t) => t.hasScreenShare && t.screenShareTrack);
  if (screenSharer) return screenSharer;
  const speaking = tiles.find((t) => t.isSpeaking && !t.isLocal);
  if (speaking) return speaking;
  const remote = tiles.find((t) => !t.isLocal);
  if (remote) return remote;
  return tiles[0] ?? null;
}

interface FloatingVideoPanelProps {
  tiles: VideoPanelParticipant[];
  isMinimized: boolean;
  onToggleMinimize: () => void;
  onDock: () => void;
}

const SPRING_CONFIG = { stiffness: 300, damping: 30 };
const EDGE_PADDING = 8;
const FLOATING_WIDTH = 220;
const FLOATING_DEFAULT_HEIGHT = 140;
const FLOATING_MIN_WIDTH = 200;
const FLOATING_MIN_HEIGHT = 150;
const VIEWPORT_PADDING = 32;

type ResizeCorner = 'tl' | 'tr' | 'bl' | 'br';

function computeResizeFromCorner(
  corner: ResizeCorner,
  origin: { width: number; height: number; x: number; y: number },
  dx: number,
  dy: number,
): { rawWidth: number; rawHeight: number; rawX: number; rawY: number } {
  switch (corner) {
    case 'br':
      return {
        rawWidth: origin.width + dx,
        rawHeight: origin.height + dy,
        rawX: origin.x,
        rawY: origin.y,
      };
    case 'tr':
      return {
        rawWidth: origin.width + dx,
        rawHeight: origin.height - dy,
        rawX: origin.x,
        rawY: origin.y + dy,
      };
    case 'bl':
      return {
        rawWidth: origin.width - dx,
        rawHeight: origin.height + dy,
        rawX: origin.x + dx,
        rawY: origin.y,
      };
    default:
      return {
        rawWidth: origin.width - dx,
        rawHeight: origin.height - dy,
        rawX: origin.x + dx,
        rawY: origin.y + dy,
      };
  }
}

export function FloatingVideoPanel({
  tiles,
  isMinimized,
  onToggleMinimize,
  onDock,
}: FloatingVideoPanelProps) {
  const posRef = useRef({ x: 16, y: 16 });
  const springX = useMotionValue(16);
  const springY = useMotionValue(16);
  const animatedX = useSpring(springX, SPRING_CONFIG);
  const animatedY = useSpring(springY, SPRING_CONFIG);
  const didInitPosRef = useRef(false);

  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const [size, setSize] = useState({ width: FLOATING_WIDTH, height: FLOATING_DEFAULT_HEIGHT });
  const [zoomTarget, setZoomTarget] = useState<ZoomTarget | null>(null);

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

  const panelWidth = isMinimized ? 160 : size.width;
  const panelHeight = isMinimized ? 28 : size.height;
  const activeTile = pickActiveTile(tiles);

  const clampPositionRef = useRef<((x: number, y: number) => { x: number; y: number }) | null>(
    null,
  );

  const clampPosition = useCallback(
    (x: number, y: number) => {
      const maxX = Math.max(EDGE_PADDING, window.innerWidth - panelWidth - EDGE_PADDING);
      const maxY = Math.max(EDGE_PADDING, window.innerHeight - panelHeight - EDGE_PADDING);
      return {
        x: Math.max(EDGE_PADDING, Math.min(maxX, x)),
        y: Math.max(EDGE_PADDING, Math.min(maxY, y)),
      };
    },
    [panelWidth, panelHeight],
  );
  clampPositionRef.current = clampPosition;

  const clampSize = useCallback((width: number, height: number) => {
    const maxW = Math.max(FLOATING_MIN_WIDTH, window.innerWidth - VIEWPORT_PADDING);
    const maxH = Math.max(FLOATING_MIN_HEIGHT, window.innerHeight - VIEWPORT_PADDING);
    return {
      width: Math.max(FLOATING_MIN_WIDTH, Math.min(maxW, width)),
      height: Math.max(FLOATING_MIN_HEIGHT, Math.min(maxH, height)),
    };
  }, []);

  useEffect(() => {
    if (didInitPosRef.current) return;
    didInitPosRef.current = true;
    const initialX = Math.max(EDGE_PADDING, window.innerWidth - FLOATING_WIDTH - EDGE_PADDING);
    const initialY = Math.max(
      EDGE_PADDING,
      window.innerHeight - FLOATING_DEFAULT_HEIGHT - EDGE_PADDING,
    );
    posRef.current = { x: initialX, y: initialY };
    springX.jump(initialX);
    springY.jump(initialY);
  }, [springX, springY]);

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

  useClearZoomWhenMissing(zoomTarget, tiles, setZoomTarget);

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
      const raw = {
        x: dragRef.current.originX + dx,
        y: dragRef.current.originY + dy,
      };
      const clamped = clampPosition(raw.x, raw.y);
      posRef.current = clamped;
      springX.set(clamped.x);
      springY.set(clamped.y);
    },
    [clampPosition, springX, springY],
  );

  const onPointerUp = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    const snapped = clampPosition(posRef.current.x, posRef.current.y);
    posRef.current = snapped;
    springX.set(snapped.x);
    springY.set(snapped.y);
  }, [clampPosition, springX, springY]);

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

      // Compute requested size and position from the dragged corner.
      const { rawWidth, rawHeight, rawX, rawY } = computeResizeFromCorner(
        r.corner,
        { width: r.originWidth, height: r.originHeight, x: r.originPosX, y: r.originPosY },
        dx,
        dy,
      );

      const clampedSize = clampSize(rawWidth, rawHeight);

      // For top/left corners, the position must reflect the actual width/height
      // we ended up with after clamping, otherwise the pinned edge drifts.
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

  const zoomedTile = zoomTarget ? tiles.find((t) => t.identity === zoomTarget.identity) : null;
  const showResize = !isMinimized;

  return (
    <>
      <motion.div
        className="fixed z-50 select-none"
        style={{
          left: animatedX,
          top: animatedY,
          width: panelWidth,
        }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card/95 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div
            className="flex h-7 cursor-grab items-center justify-between border-b border-border/30 bg-muted/40 px-2 active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <div className="flex items-center gap-1">
              <GripHorizontal className="size-2.5 text-muted-foreground/40" />
              <Video className="size-2.5 text-muted-foreground/60" />
              <span className="rounded-full bg-muted px-1.5 py-px font-mono text-[8px] tabular-nums text-muted-foreground/70">
                {tiles.length}
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="size-4 text-muted-foreground/60 hover:text-foreground"
                onClick={onDock}
                aria-label="Dock to side panel"
              >
                <PanelRight className="size-2.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="size-4 text-muted-foreground/60 hover:text-foreground"
                onClick={onToggleMinimize}
              >
                {isMinimized ? (
                  <Maximize2 className="size-2.5" />
                ) : (
                  <Minimize2 className="size-2.5" />
                )}
              </Button>
            </div>
          </div>

          {!isMinimized ? (
            <div className="relative overflow-hidden p-1" style={{ height: size.height - 28 }}>
              <AnimatePresence mode="popLayout">
                {activeTile ? (
                  <motion.div
                    key={`${activeTile.identity}-${activeTile.hasScreenShare ? 'screen' : 'cam'}`}
                    className="h-full"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {activeTile.hasScreenShare && activeTile.screenShareTrack ? (
                      <ScreenShareTile
                        displayName={activeTile.displayName}
                        screenShareTrack={activeTile.screenShareTrack}
                        fill
                        onZoom={() =>
                          setZoomTarget({ identity: activeTile.identity, kind: 'screen' })
                        }
                      />
                    ) : (
                      <div className="h-full">
                        <ParticipantTile
                          {...activeTile}
                          fit="contain"
                          onZoom={() =>
                            setZoomTarget({ identity: activeTile.identity, kind: 'camera' })
                          }
                        />
                      </div>
                    )}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          ) : null}

          {showResize ? (
            <>
              <button
                type="button"
                tabIndex={-1}
                aria-label="Resize panel from top left"
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
                aria-label="Resize panel from top right"
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
                aria-label="Resize panel from bottom left"
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
                aria-label="Resize panel from bottom right"
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
      <AnimatePresence>
        {zoomedTile ? (
          <ZoomOverlay
            key={`${zoomedTile.identity}-${zoomTarget?.kind}`}
            tile={zoomedTile}
            kind={zoomTarget?.kind ?? 'camera'}
            onClose={() => setZoomTarget(null)}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}

interface DockedVideoPanelProps {
  tiles: VideoPanelParticipant[];
  onUndock: () => void;
}

export function DockedVideoPanel({ tiles, onUndock }: DockedVideoPanelProps) {
  const [zoomTarget, setZoomTarget] = useState<ZoomTarget | null>(null);

  const hasAnyVideo = tiles.some((t) => t.hasVideo);
  const hasAnyScreenShare = tiles.some((t) => t.hasScreenShare);
  const hasRemote = tiles.some((t) => !t.isLocal);

  useClearZoomWhenMissing(zoomTarget, tiles, setZoomTarget);

  // Hide only when there's nothing worth showing: no remote peer, no camera
  // feed anywhere, and no screen share. A solo local camera still renders.
  if (tiles.length === 0 || (!hasRemote && !hasAnyVideo && !hasAnyScreenShare)) return null;

  const screenSharers = tiles.filter(
    (t): t is VideoPanelParticipant & { screenShareTrack: MediaStreamTrack } =>
      t.hasScreenShare && t.screenShareTrack !== null,
  );

  const zoomedTile = zoomTarget ? tiles.find((t) => t.identity === zoomTarget.identity) : null;

  return (
    <div className="shrink-0 border-b border-border p-2 @container">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Video className="size-3 text-muted-foreground/60" />
          <span className="rounded-full bg-muted px-1.5 py-px font-mono text-[9px] tabular-nums text-muted-foreground/70">
            {tiles.length}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="size-5 text-muted-foreground/60 hover:text-foreground"
          onClick={onUndock}
          aria-label="Undock to floating panel"
        >
          <PanelRightClose className="size-2.5" />
        </Button>
      </div>
      <div className="flex flex-col gap-1">
        {screenSharers.map((tile) => (
          <ScreenShareTile
            key={`screen-${tile.identity}`}
            displayName={tile.displayName}
            screenShareTrack={tile.screenShareTrack}
            onZoom={() => setZoomTarget({ identity: tile.identity, kind: 'screen' })}
          />
        ))}
        <div className="grid grid-cols-1 gap-1 @[280px]:grid-cols-2">
          {tiles.map((tile) => (
            <ParticipantTile
              key={tile.identity}
              {...tile}
              onZoom={() => setZoomTarget({ identity: tile.identity, kind: 'camera' })}
            />
          ))}
        </div>
      </div>
      <AnimatePresence>
        {zoomedTile ? (
          <ZoomOverlay
            key={`${zoomedTile.identity}-${zoomTarget?.kind}`}
            tile={zoomedTile}
            kind={zoomTarget?.kind ?? 'camera'}
            onClose={() => setZoomTarget(null)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
