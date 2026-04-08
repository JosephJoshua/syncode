import * as React from 'react';

import { cn } from '../lib/cn.js';

function Avatar({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="avatar"
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/25 bg-card/90 text-[11px] font-semibold text-primary ring-1 ring-primary/20 shadow-[0_0_18px_-7px_oklch(0.82_0.18_165/0.65)]',
        className,
      )}
      {...props}
    />
  );
}

function AvatarImage({ className, alt = '', ...props }: React.ComponentProps<'img'>) {
  const [status, setStatus] = React.useState<'loading' | 'loaded' | 'error'>('loading');

  return status === 'error' ? null : (
    <img
      data-slot="avatar-image"
      alt={alt}
      className={cn('aspect-square size-full object-cover', className)}
      onLoad={() => setStatus('loaded')}
      onError={() => setStatus('error')}
      {...props}
    />
  );
}

function AvatarFallback({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="avatar-fallback"
      className={cn(
        'inline-flex size-full items-center justify-center uppercase text-primary',
        className,
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback };
