import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      style={{
        WebkitBoxShadow: '0 0 0 1000px #ffffff inset',
        WebkitTextFillColor: '#111827',
        caretColor: '#111827',
      }}
      className={cn(
        'flex h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 disabled:opacity-100 placeholder:text-gray-400 autofill:bg-white',
        className,
      )}
      {...props}
    />
  );
});

Input.displayName = 'Input';
