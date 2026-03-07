import { ChevronDown } from 'lucide-react';
import type { ComponentPropsWithoutRef } from 'react';

interface SelectProps extends ComponentPropsWithoutRef<'select'> {
  label?: string;
  error?: string;
}

export function Select({ label, error, className = '', id, children, ...rest }: SelectProps) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          className={`h-9 w-full appearance-none rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 pr-8 text-sm text-[var(--text-primary)] focus:border-[var(--border-strong)] focus:ring-2 focus:ring-[var(--accent-muted)] focus:outline-none transition-colors ${error ? 'border-[var(--error)]' : ''} ${className}`}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
          size={16}
        />
      </div>
      {error && <p className="mt-1 text-xs text-[var(--error)]">{error}</p>}
    </div>
  );
}
