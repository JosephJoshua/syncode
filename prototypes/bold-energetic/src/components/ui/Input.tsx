import type { ComponentPropsWithoutRef } from 'react';
import { forwardRef, useId } from 'react';

interface InputProps extends ComponentPropsWithoutRef<'input'> {
  label?: string;
  error?: string;
}

interface TextareaProps extends ComponentPropsWithoutRef<'textarea'> {
  label?: string;
  error?: string;
}

const baseInputStyles =
  'w-full rounded-lg bg-[var(--bg-card)] border border-[var(--border-default)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-all duration-200 outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed';

const errorInputStyles = 'ring-2 ring-[var(--error)]/50 border-[var(--error)]';

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className = '', id, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <div>
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
        ref={ref}
        className={`h-10 ${baseInputStyles} ${error ? errorInputStyles : ''} ${className}`}
        {...rest}
      />
      {error && <p className="text-xs text-[var(--error)] mt-1">{error}</p>}
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, className = '', id, ...rest },
  ref,
) {
  const autoId = useId();
  const textareaId = id ?? autoId;

  return (
    <div>
      {label && (
        <label
          htmlFor={textareaId}
          className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
        >
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        ref={ref}
        className={`min-h-[100px] py-2 ${baseInputStyles} ${error ? errorInputStyles : ''} ${className}`}
        {...rest}
      />
      {error && <p className="text-xs text-[var(--error)] mt-1">{error}</p>}
    </div>
  );
});
