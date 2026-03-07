import type React from 'react';

export function staggeredEntrance(index: number, baseDelay = 60): React.CSSProperties {
  return {
    animation: 'fadeInUp 400ms ease-out both',
    animationDelay: `${baseDelay + index * 80}ms`,
  };
}

export function fadeIn(delay = 0): React.CSSProperties {
  return {
    animation: 'fadeIn 300ms ease-out both',
    animationDelay: `${delay}ms`,
  };
}

export function fadeInUp(delay = 0): React.CSSProperties {
  return {
    animation: 'fadeInUp 400ms ease-out both',
    animationDelay: `${delay}ms`,
  };
}
