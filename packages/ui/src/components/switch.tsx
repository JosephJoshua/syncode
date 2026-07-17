import { Switch as SwitchPrimitive } from 'radix-ui';
import type * as React from 'react';
import { cn } from '../lib/cn.js';

function Switch({
  className,
  trackContent,
  thumbClassName,
  thumbPositionClassName,
  thumbContent,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  trackContent?: React.ReactNode;
  thumbClassName?: string;
  thumbPositionClassName?: string;
  thumbContent?: React.ReactNode;
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent outline-none transition-all duration-200 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {trackContent}
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none flex size-5 items-center justify-center rounded-full text-foreground ring-0 transition-[transform,background-color,color,opacity] duration-200',
          thumbPositionClassName ??
            'data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0',
          thumbClassName,
        )}
      >
        {thumbContent}
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  );
}

export { Switch };
