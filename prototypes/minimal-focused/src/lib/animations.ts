import type { CSSProperties } from 'react';

/** CSS inline style helper for staggered fade-in-up animations */
export function staggeredEntrance(index: number, baseDelay = 0): CSSProperties {
  return {
    animationName: 'fadeInUp',
    animationDuration: '400ms',
    animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
    animationFillMode: 'both',
    animationDelay: `${baseDelay + index * 60}ms`,
  };
}

/** Simple fade-in (no vertical movement) */
export function fadeIn(delay = 0): CSSProperties {
  return {
    animationName: 'fadeIn',
    animationDuration: '400ms',
    animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
    animationFillMode: 'both',
    animationDelay: `${delay}ms`,
  };
}

/** Fade-in-up with explicit delay */
export function fadeInUp(delay = 0): CSSProperties {
  return {
    animationName: 'fadeInUp',
    animationDuration: '400ms',
    animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
    animationFillMode: 'both',
    animationDelay: `${delay}ms`,
  };
}
