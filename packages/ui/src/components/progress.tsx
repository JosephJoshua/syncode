import { Progress as ProgressPrimitive } from 'radix-ui';
import type * as React from 'react';
import { cn } from '../lib/cn.js';

function Progress({
  className,
  indicatorClassName,
  value = 0,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  indicatorClassName?: string;
  value?: number;
}) {
  const normalizedValue = Number.isNaN(value) ? 0 : Math.min(Math.max(value, 0), 100);

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}
      value={normalizedValue}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          'h-full w-full rounded-full bg-primary transition-transform',
          indicatorClassName,
        )}
        style={{ transform: `translateX(-${100 - normalizedValue}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
