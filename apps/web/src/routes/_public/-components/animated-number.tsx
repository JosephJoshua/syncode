import { animate, useInView, useMotionValue, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';

interface AnimatedNumberProps {
  /** Target value the counter animates toward. */
  readonly to: number;
  /** Optional starting value. Defaults to 0. */
  readonly from?: number;
  /** Animation duration in seconds. Defaults to 2.0. */
  readonly duration?: number;
}

/**
 * AnimatedNumber — count-up counter that fires once when scrolled into view.
 *
 * Extracted from the original 632-line landing monolith. Identical behaviour
 * to the in-file version, with one upgrade: respects `prefers-reduced-motion`
 * by snapping straight to the final value rather than tweening.
 */
export function AnimatedNumber({ to, from = 0, duration = 2 }: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const val = useMotionValue(from);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion) {
      // Snap to final value immediately — no tween.
      if (ref.current) ref.current.textContent = String(to);
      val.set(to);
      return;
    }
    const controls = animate(val, to, { duration, ease: 'easeOut' });
    return () => controls.stop();
  }, [inView, prefersReducedMotion, val, to, duration]);

  useEffect(() => {
    return val.on('change', (v) => {
      if (ref.current) ref.current.textContent = String(Math.round(v));
    });
  }, [val]);

  return <span ref={ref}>{from}</span>;
}
