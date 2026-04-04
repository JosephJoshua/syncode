import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';

import { cn } from '../lib/cn';

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'border-border/70 bg-muted/85 text-foreground/90',
        candidate: 'border-cyan-400/35 bg-cyan-400/18 text-cyan-300',
        interviewer: 'border-fuchsia-400/35 bg-fuchsia-400/18 text-fuchsia-300',
        observer: 'border-indigo-400/35 bg-indigo-400/18 text-indigo-300',
        success: 'border-primary/25 bg-primary/18 text-primary',
        warning: 'border-amber-400/25 bg-amber-400/16 text-amber-400',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant, className }))} {...props} />
  );
}

export { Badge, badgeVariants };
