import { motion, useSpring } from 'motion/react';
import { type MouseEvent as ReactMouseEvent, type ReactNode, useCallback, useRef } from 'react';

export function TiltCard({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const rotateX = useSpring(0, { stiffness: 200, damping: 30 });
  const rotateY = useSpring(0, { stiffness: 200, damping: 30 });

  const handleMouseMove = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      // Normalize to -1..1, then scale to degrees
      const x = ((e.clientX - centerX) / (rect.width / 2)) * 3;
      const y = ((e.clientY - centerY) / (rect.height / 2)) * -3;
      rotateY.set(x);
      rotateX.set(y);
    },
    [rotateX, rotateY],
  );

  const handleMouseLeave = useCallback(() => {
    rotateX.set(0);
    rotateY.set(0);
  }, [rotateX, rotateY]);

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformPerspective: 800,
        transformStyle: 'preserve-3d',
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
