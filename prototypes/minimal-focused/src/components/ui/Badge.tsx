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
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-[rgba(34,197,94,0.1)] text-[var(--success)]',
  warning: 'bg-[rgba(245,158,11,0.1)] text-[var(--warning)]',
  error: 'bg-[rgba(239,68,68,0.1)] text-[var(--error)]',
  info: 'bg-[rgba(59,130,246,0.1)] text-[var(--info)]',
  neutral: 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]',
  easy: 'bg-[rgba(34,197,94,0.1)] text-green-500',
  medium: 'bg-[rgba(245,158,11,0.1)] text-amber-500',
  hard: 'bg-[rgba(239,68,68,0.1)] text-red-500',
};

export function Badge({ variant = 'neutral', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
