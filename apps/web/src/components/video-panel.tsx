import { Avatar, AvatarFallback, AvatarImage, Button, cn } from '@syncode/ui';
import {
  GripHorizontal,
  Maximize2,
  Minimize2,
  MonitorUp,
  PanelRight,
  PanelRightClose,
  Video,
  X,
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

  const handleDoubleClick = onZoom
    ? (e: React.MouseEvent) => {
        e.preventDefault();
        onZoom();
      }
    : undefined;

  const interactiveProps = onZoom
    ? {
        role: 'button' as const,
        tabIndex: -1,
        onDoubleClick: handleDoubleClick,
      }
    : undefined;

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

  const handleDoubleClick = onZoom
    ? (e: React.MouseEvent) => {
        e.preventDefault();
        onZoom();
      }
    : undefined;

  const interactiveProps = onZoom
    ? {
        role: 'button' as const,
        tabIndex: -1,
        onDoubleClick: handleDoubleClick,
      }
    : undefined;

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

type ZoomTarget = { identity: string; kind: 'camera' | 'screen' };

interface ZoomOverlayProps {
  tile: VideoPanelParticipant;
  kind: 'camera' | 'screen';
  onClose: () => void;
}

function ZoomOverlay({ tile, kind, onClose }: ZoomOverlayProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isScreen = kind === 'screen' && tile.hasScreenShare && tile.screenShareTrack;

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      role="dialog"
      aria-modal="true"
      aria-label="Zoomed video"
    >
      <button
        type="button"
        aria-label="Close zoom"
        className="absolute inset-0 cursor-default bg-transparent"
        onClick={onClose}
      />
      <div className="relative flex h-[min(88vh,calc(88vw*9/16))] w-[min(92vw,calc(88vh*16/9))] items-center justify-center">
        {isScreen && tile.screenShareTrack ? (
          <ScreenShareTile
            displayName={tile.displayName}
            screenShareTrack={tile.screenShareTrack}
            fill
          />
        ) : (
          <div className="h-full w-full">
            <ParticipantTile {...tile} fit="contain" />
          </div>
        )}
        <div className="absolute right-2 top-2 flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8 bg-black/50 text-white/90 backdrop-blur-sm hover:bg-black/70 hover:text-white"
            onClick={onClose}
            aria-label="Exit zoom"
          >
            <Minimize2 className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8 bg-black/50 text-white/90 backdrop-blur-sm hover:bg-black/70 hover:text-white"
            onClick={onClose}
            aria-label="Close zoom"
          >
            <X className="size-4" />
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

  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const [size, setSize] = useState({ width: FLOATING_WIDTH, height: FLOATING_DEFAULT_HEIGHT });
  const [zoomTarget, setZoomTarget] = useState<ZoomTarget | null>(null);

  const resizeRef = useRef<{
    startX: number;
    startY: number;
    originWidth: number;
    originHeight: number;
  } | null>(null);

  const panelWidth = isMinimized ? 160 : size.width;
  const activeTile = pickActiveTile(tiles);

  const clampPositionRef = useRef<((x: number, y: number) => { x: number; y: number }) | null>(
    null,
  );

  const clampPosition = useCallback(
    (x: number, y: number) => {
      const maxRight = window.innerWidth - panelWidth - EDGE_PADDING;
      const maxBottom = window.innerHeight - 48 - EDGE_PADDING;
      return {
        x: Math.max(EDGE_PADDING, Math.min(maxRight, x)),
        y: Math.max(EDGE_PADDING, Math.min(maxBottom, y)),
      };
    },
    [panelWidth],
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

  useEffect(() => {
    if (zoomTarget === null) return;
    const stillPresent = tiles.some((t) => {
      if (t.identity !== zoomTarget.identity) return false;
      if (zoomTarget.kind === 'screen') return t.hasScreenShare && t.screenShareTrack !== null;
      return true;
    });
    if (!stillPresent) setZoomTarget(null);
  }, [tiles, zoomTarget]);

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
        x: dragRef.current.originX - dx,
        y: dragRef.current.originY - dy,
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

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        originWidth: size.width,
        originHeight: size.height,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [size.width, size.height],
  );

  const onResizePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!resizeRef.current) return;
      const dx = e.clientX - resizeRef.current.startX;
      const dy = e.clientY - resizeRef.current.startY;
      setSize(clampSize(resizeRef.current.originWidth + dx, resizeRef.current.originHeight + dy));
    },
    [clampSize],
  );

  const onResizePointerUp = useCallback(() => {
    resizeRef.current = null;
  }, []);

  const zoomedTile = zoomTarget ? tiles.find((t) => t.identity === zoomTarget.identity) : null;
  const showResize = !isMinimized;

  return (
    <>
      <motion.div
        className="fixed z-50 select-none"
        style={{
          right: animatedX,
          bottom: animatedY,
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
            <div
              role="slider"
              aria-label="Resize video panel"
              aria-valuemin={FLOATING_MIN_WIDTH}
              aria-valuemax={window.innerWidth - VIEWPORT_PADDING}
              aria-valuenow={size.width}
              tabIndex={0}
              className="absolute bottom-0 right-0 z-10 flex size-4 cursor-nwse-resize items-end justify-end text-muted-foreground/50 hover:text-muted-foreground"
              onPointerDown={onResizePointerDown}
              onPointerMove={onResizePointerMove}
              onPointerUp={onResizePointerUp}
              onPointerCancel={onResizePointerUp}
            >
              <svg viewBox="0 0 10 10" className="size-2.5 pointer-events-none" aria-hidden="true">
                <title>Resize</title>
                <path
                  d="M1 9 L9 9 M4 9 L9 4 M7 9 L9 7"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </div>
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

  useEffect(() => {
    if (zoomTarget === null) return;
    const stillPresent = tiles.some((t) => {
      if (t.identity !== zoomTarget.identity) return false;
      if (zoomTarget.kind === 'screen') return t.hasScreenShare && t.screenShareTrack !== null;
      return true;
    });
    if (!stillPresent) setZoomTarget(null);
  }, [tiles, zoomTarget]);

  if (tiles.length === 0 || (tiles.length <= 1 && !hasAnyVideo && !hasAnyScreenShare)) return null;

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
