import type { ComponentPropsWithoutRef } from 'react';
import { forwardRef, useId } from 'react';

interface SelectProps extends ComponentPropsWithoutRef<'select'> {
  label?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, className = '', children, id, ...rest },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;

  return (
    <div>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        ref={ref}
        className={`h-10 w-full rounded-lg bg-[var(--bg-card)] border border-[var(--border-default)] px-3 text-sm text-[var(--text-primary)] transition-all duration-200 outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        {...rest}
      >
        {children}
      </select>
    </div>
  );
});
