import { forwardRef, type LabelHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { className, ...props },
  ref,
) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: This shared primitive forwards htmlFor and accessible text from callers.
    <label ref={ref} className={cn('text-sm font-medium text-gray-700', className)} {...props} />
  );
});

Label.displayName = 'Label';
