import type { ReactNode } from 'react';

/**
 * Standard page background with dot-grid pattern and accent glow orbs.
 * Used on landing, login, register, and other public-facing pages.
 */
export function PageBackground({ children }: { children?: ReactNode }) {
  return (
    <>
      <div className="dot-grid pointer-events-none absolute inset-0 opacity-30" />
      {children}
    </>
  );
}

export function GlowOrb({
  className,
  size = 'md',
}: {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses = {
    sm: 'h-48 w-48 blur-[80px]',
    md: 'h-72 w-72 blur-[120px]',
    lg: 'h-96 w-96 blur-[160px]',
  };

  return (
    <div
      className={`pointer-events-none absolute rounded-full bg-primary/8 ${sizeClasses[size]} ${className ?? ''}`}
    />
  );
}
