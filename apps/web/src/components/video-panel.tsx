import { Avatar, AvatarFallback, AvatarImage, Button, cn } from '@syncode/ui';
import {
  GripHorizontal,
  Maximize2,
  Minimize2,
  PanelRight,
  PanelRightClose,
  Video,
} from 'lucide-react';
import { AnimatePresence, motion, useMotionValue, useSpring } from 'motion/react';
import { useCallback, useEffect, useRef } from 'react';

export interface VideoPanelParticipant {
  identity: string;
  displayName: string;
  avatarUrl: string | null;
  hasVideo: boolean;
  videoTrack: MediaStreamTrack | null;
  isSpeaking: boolean;
  isLocal: boolean;
}

function ParticipantTile({
  displayName,
  avatarUrl,
  hasVideo,
  videoTrack,
  isSpeaking,
  isLocal,
}: Omit<VideoPanelParticipant, 'identity'>) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const initial = displayName
    .replace(/\s*\(You\)$/, '')
    .charAt(0)
    .toUpperCase();

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !videoTrack) return;
    const stream = new MediaStream([videoTrack]);
    el.srcObject = stream;
    return () => {
      el.srcObject = null;
    };
  }, [videoTrack]);

  return (
    <div
      className={cn(
        'relative aspect-video overflow-hidden rounded-lg bg-muted/80 transition-shadow duration-200',
        isSpeaking && 'ring-2 ring-emerald-400/70 shadow-[0_0_12px_-3px_oklch(0.75_0.18_155/0.4)]',
      )}
    >
      {hasVideo && videoTrack ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn('h-full w-full object-cover', isLocal && 'scale-x-[-1]')}
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

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent px-2 pb-1.5 pt-5">
        <div className="flex items-center gap-1.5">
          {isSpeaking ? (
            <span className="size-1.5 shrink-0 rounded-full bg-emerald-400 live-pulse" />
          ) : null}
          <span className="font-mono text-[10px] font-medium text-white/90 drop-shadow-sm">
            {displayName}
          </span>
        </div>
      </div>
    </div>
  );
}

function pickActiveTile(tiles: VideoPanelParticipant[]): VideoPanelParticipant | null {
  if (tiles.length === 0) return null;
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

  const panelWidth = isMinimized ? 160 : FLOATING_WIDTH;
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

  useEffect(() => {
    const onResize = () => {
      const fn = clampPositionRef.current;
      if (!fn) return;
      const clamped = fn(posRef.current.x, posRef.current.y);
      posRef.current = clamped;
      springX.set(clamped.x);
      springY.set(clamped.y);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [springX, springY]);

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

  return (
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
      <div className="overflow-hidden rounded-xl border border-border/50 bg-card/95 shadow-2xl shadow-black/20 backdrop-blur-xl">
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
          <div className="relative p-1">
            <AnimatePresence mode="popLayout">
              {activeTile ? (
                <motion.div
                  key={activeTile.identity}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ParticipantTile {...activeTile} />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

interface DockedVideoPanelProps {
  tiles: VideoPanelParticipant[];
  onUndock: () => void;
}

export function DockedVideoPanel({ tiles, onUndock }: DockedVideoPanelProps) {
  const hasAnyVideo = tiles.some((t) => t.hasVideo);
  if (tiles.length === 0 || (tiles.length <= 1 && !hasAnyVideo)) return null;

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
      <div className="grid grid-cols-1 gap-1 @[280px]:grid-cols-2">
        {tiles.map((tile) => (
          <ParticipantTile key={tile.identity} {...tile} />
        ))}
      </div>
    </div>
  );
}
