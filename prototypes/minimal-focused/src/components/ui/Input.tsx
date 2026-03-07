import type { ComponentPropsWithoutRef } from 'react';

interface InputProps extends ComponentPropsWithoutRef<'input'> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', id, ...rest }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`h-9 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-strong)] focus:ring-2 focus:ring-[var(--accent-muted)] focus:outline-none transition-colors ${error ? 'border-[var(--error)]' : ''} ${className}`}
        {...rest}
      />
      {error && <p className="mt-1 text-xs text-[var(--error)]">{error}</p>}
    </div>
  );
}

interface TextareaProps extends ComponentPropsWithoutRef<'textarea'> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className = '', id, ...rest }: TextareaProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
        >
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={`w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-strong)] focus:ring-2 focus:ring-[var(--accent-muted)] focus:outline-none transition-colors resize-y min-h-[80px] ${error ? 'border-[var(--error)]' : ''} ${className}`}
        {...rest}
      />
      {error && <p className="mt-1 text-xs text-[var(--error)]">{error}</p>}
    </div>
  );
}
