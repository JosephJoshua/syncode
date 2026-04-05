import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '../lib/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary/15 text-primary',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border bg-transparent text-muted-foreground',
        success: 'border-transparent',
        warning: 'border-transparent',
        destructive: 'border-transparent',
      },
      size: {
        default: 'h-6 px-2.5',
        sm: 'h-5 px-2.5 text-[11px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

const semanticBadgeStyles = {
  success: {
    backgroundColor: 'color-mix(in oklab, var(--success) 15%, transparent)',
    borderColor: 'color-mix(in oklab, var(--success) 20%, transparent)',
    color: 'var(--success)',
  },
  warning: {
    backgroundColor: 'color-mix(in oklab, var(--warning) 15%, transparent)',
    borderColor: 'color-mix(in oklab, var(--warning) 20%, transparent)',
    color: 'var(--warning)',
  },
  destructive: {
    backgroundColor: 'color-mix(in oklab, var(--destructive) 15%, transparent)',
    borderColor: 'color-mix(in oklab, var(--destructive) 20%, transparent)',
    color: 'var(--destructive)',
  },
} satisfies Record<'success' | 'warning' | 'destructive', React.CSSProperties>;

function Badge({
  className,
  variant,
  size,
  style,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  const semanticStyle =
    variant === 'success' || variant === 'warning' || variant === 'destructive'
      ? semanticBadgeStyles[variant]
      : undefined;

  return (
    <span
      className={cn(badgeVariants({ variant, size }), className)}
      style={{ ...semanticStyle, ...style }}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
