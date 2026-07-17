import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import type * as React from 'react';
import { cn } from '../lib/cn.js';

function Checkbox({
  className,
  checked,
  style,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  const isChecked = checked === true || checked === 'indeterminate';

  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer inline-flex size-4 shrink-0 items-center justify-center rounded-[5px] border bg-background/80 text-primary outline-none transition-all focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-card/95',
        className,
      )}
      checked={checked}
      style={{
        borderWidth: '1.5px',
        borderColor: isChecked ? 'var(--primary)' : 'rgb(255 255 255 / 0.82)',
        boxShadow: isChecked
          ? 'inset 0 0 0 1px oklch(0.82 0.18 165 / 0.22)'
          : 'inset 0 0 0 1px rgb(255 255 255 / 0.12)',
        ...style,
      }}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-primary">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3.5"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
