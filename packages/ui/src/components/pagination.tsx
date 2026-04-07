import type * as React from 'react';
import { cn } from '../lib/cn.js';
import { buttonVariants } from './button.js';

function Pagination({ className, ...props }: React.ComponentProps<'nav'>) {
  return (
    <nav aria-label="Pagination" className={cn('flex justify-center', className)} {...props} />
  );
}

function PaginationContent({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul className={cn('flex flex-wrap items-center justify-center gap-2', className)} {...props} />
  );
}

function PaginationItem({ className, ...props }: React.ComponentProps<'li'>) {
  return <li className={cn('list-none', className)} {...props} />;
}

function PaginationLink({
  className,
  isActive,
  size = 'icon-sm',
  ...props
}: React.ComponentProps<'button'> & {
  isActive?: boolean;
  size?: 'default' | 'sm' | 'icon' | 'icon-sm';
}) {
  return (
    <button
      type="button"
      aria-current={isActive ? 'page' : undefined}
      data-active={isActive ? 'true' : undefined}
      className={cn(
        buttonVariants({
          variant: isActive ? 'outline' : 'ghost',
          size,
        }),
        isActive &&
          'border-primary/25 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
        !isActive && 'text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

function ChevronLeftIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function PaginationPrevious({ className, children, ...props }: React.ComponentProps<'button'>) {
  return (
    <PaginationLink className={cn('gap-1.5 px-3.5 text-sm', className)} size="sm" {...props}>
      <ChevronLeftIcon className="size-4" />
      {children ?? 'Previous'}
    </PaginationLink>
  );
}

function PaginationNext({ className, children, ...props }: React.ComponentProps<'button'>) {
  return (
    <PaginationLink className={cn('gap-1.5 px-3.5 text-sm', className)} size="sm" {...props}>
      {children ?? 'Next'}
      <ChevronRightIcon className="size-4" />
    </PaginationLink>
  );
}

function PaginationEllipsis({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-7 items-center justify-center text-sm text-muted-foreground',
        className,
      )}
      {...props}
    >
      ...
    </span>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
};
