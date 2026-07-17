import { cn } from '@syncode/ui';
import type React from 'react';

export type FilterPillProps = {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
  readonly className?: string;
};

export function FilterPill({ active, onClick, children, className }: FilterPillProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center rounded-full px-3 text-xs font-medium transition-colors',
        active
          ? 'bg-primary/10 text-primary ring-1 ring-primary/25'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
        className,
      )}
    >
      {children}
    </button>
  );
}
