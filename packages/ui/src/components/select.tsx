import type * as React from 'react';

import { cn } from '../lib/cn';

function Select({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        data-slot="select"
        className={cn(
          'h-11 w-full appearance-none rounded-lg border border-input bg-card text-sm text-foreground transition-colors outline-none forced-color-adjust-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 dark:bg-card [&_option]:bg-card [&_option]:text-foreground [&_option]:disabled:text-muted-foreground/50 [&_option:checked]:bg-muted [&_option:checked]:text-foreground',
          className,
        )}
        style={{ colorScheme: 'dark' }}
        {...props}
      >
        {children}
      </select>
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      >
        <path
          d="M4 6.5 8 10.5 12 6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export { Select };
