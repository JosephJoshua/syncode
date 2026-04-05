import { motion, useMotionValue, useTransform } from 'motion/react';
import { memo, type MouseEvent as ReactMouseEvent, useCallback } from 'react';

export const CursorSpotlight = memo(function CursorSpotlight() {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const offsetX = useTransform(x, (v) => v - 128);
  const offsetY = useTransform(y, (v) => v - 128);

  const handleMouseMove = useCallback(
    (e: ReactMouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    },
    [x, y],
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: spotlight tracker needs mouse events on container
    <div className="absolute inset-0 z-0" onMouseMove={handleMouseMove}>
      <motion.div
        className="pointer-events-none absolute h-64 w-64 rounded-full bg-primary/[0.04] blur-[80px]"
        style={{ x: offsetX, y: offsetY }}
      />
    </div>
  );
});
