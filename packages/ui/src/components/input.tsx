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
      className={cn(
        'flex h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-sm text-gray-900 caret-gray-900 outline-none transition placeholder:text-gray-400 autofill:shadow-[inset_0_0_0_1000px_white] autofill:[-webkit-text-fill-color:theme(colors.gray.900)] focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500',
        className,
      )}
      {...props}
    />
  );
});

Input.displayName = 'Input';
