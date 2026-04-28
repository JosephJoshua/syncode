import { type MotionValue, useMotionValue, useSpring } from 'motion/react';
import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef } from 'react';
import {
  clampPosition as clampPositionFor,
  clampSize as clampSizeFor,
  computeResizeFromCorner,
  type PersistedGeom,
  type ResizeCorner,
} from '@/lib/floating-panel-geometry.js';

const SPRING_CONFIG = { stiffness: 300, damping: 30 };

export interface FloatingPanelSize {
  width: number;
  height: number;
}

export interface UseFloatingPanelArgs {
  readonly size: FloatingPanelSize;
  readonly setSize: Dispatch<SetStateAction<FloatingPanelSize>>;
  // Effective panel dimensions used for clamping the position. Callers pass
  // the post-minimize values (e.g. header height when minimized). Owning size
  // outside the hook lets the caller derive these without a chicken-and-egg.
  readonly panelWidth: number;
  readonly panelHeight: number;
  readonly minWidth: number;
  readonly minHeight: number;
  // Called once after mount to resolve the initial position. The returned
  // point is then clamped to the viewport before being applied.
  readonly getInitialPosition: () => { x: number; y: number };
  // Fired when the user finishes a drag and whenever size changes commit
  // (window resize, corner-resize). Wire this to localStorage to persist.
  readonly onCommit?: (geom: PersistedGeom) => void;
}

export interface UseFloatingPanelResult {
  readonly animatedX: MotionValue<number>;
  readonly animatedY: MotionValue<number>;
  readonly onPointerDown: (e: React.PointerEvent) => void;
  readonly onPointerMove: (e: React.PointerEvent) => void;
  readonly onPointerUp: (e: React.PointerEvent) => void;
  readonly startResize: (corner: ResizeCorner) => (e: React.PointerEvent) => void;
  readonly onResizePointerMove: (e: React.PointerEvent) => void;
  readonly endResize: (e?: React.PointerEvent) => void;
}

export function useFloatingPanel({
  size,
  setSize,
  panelWidth,
  panelHeight,
  minWidth,
  minHeight,
  getInitialPosition,
  onCommit,
}: UseFloatingPanelArgs): UseFloatingPanelResult {
  const posRef = useRef({ x: 0, y: 0 });
  const springX = useMotionValue(0);
  const springY = useMotionValue(0);
  const animatedX = useSpring(springX, SPRING_CONFIG);
  const animatedY = useSpring(springY, SPRING_CONFIG);
  const didInitPosRef = useRef(false);

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

  // Indirection so the resize-listener closure always sees the latest clamp.
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
      clampSizeFor(width, height, window.innerWidth, window.innerHeight, minWidth, minHeight),
    [minWidth, minHeight],
  );

  // Initial positioning: resolve the requested starting point and clamp it.
  useEffect(() => {
    if (didInitPosRef.current) return;
    didInitPosRef.current = true;
    const start = getInitialPosition();
    const clamped = clampPosition(start.x, start.y);
    posRef.current = clamped;
    springX.jump(clamped.x);
    springY.jump(clamped.y);
  }, [getInitialPosition, clampPosition, springX, springY]);

  // Re-clamp on viewport resize so the panel stays on-screen.
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
  }, [springX, springY, clampSize, setSize]);

  // Persist on size changes (resize commits, window-resize re-clamps).
  useEffect(() => {
    onCommit?.({
      x: posRef.current.x,
      y: posRef.current.y,
      width: size.width,
      height: size.height,
    });
  }, [size.width, size.height, onCommit]);

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
      onCommit?.({
        x: posRef.current.x,
        y: posRef.current.y,
        width: size.width,
        height: size.height,
      });
      const target = e.target as HTMLElement;
      if (target.hasPointerCapture?.(e.pointerId)) {
        target.releasePointerCapture(e.pointerId);
      }
    },
    [onCommit, size.width, size.height],
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
    [clampSize, clampPosition, springX, springY, setSize],
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
    [springX, springY, setSize],
  );

  useEffect(() => {
    return () => {
      if (resizeRafRef.current !== null) cancelAnimationFrame(resizeRafRef.current);
    };
  }, []);

  return {
    animatedX,
    animatedY,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    startResize,
    onResizePointerMove,
    endResize,
  };
}
