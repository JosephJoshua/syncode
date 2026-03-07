import type { ReactNode } from 'react';

type BadgeVariant =
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'neutral'
  | 'easy'
  | 'medium'
  | 'hard';

interface BadgeProps {
  variant: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-[rgba(46,196,182,0.12)] text-[var(--success)]',
  warning: 'bg-[rgba(255,179,71,0.12)] text-[var(--warning)]',
  error: 'bg-[rgba(220,38,38,0.12)] text-[var(--error)]',
  info: 'bg-[var(--primary-muted)] text-[var(--primary)]',
  neutral: 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]',
  easy: 'bg-[rgba(46,196,182,0.12)] text-[#059669]',
  medium: 'bg-[rgba(255,159,28,0.12)] text-[#D97706]',
  hard: 'bg-[rgba(220,38,38,0.12)] text-[#DC2626]',
};

export function Badge({ variant, children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
