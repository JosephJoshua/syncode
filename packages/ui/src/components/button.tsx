import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from 'react';
import { cn } from '../lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'default' | 'sm' | 'lg';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'border border-gray-900 bg-gray-900 text-white hover:border-gray-800 hover:bg-gray-800',
  secondary: 'border border-gray-300 bg-white text-gray-900 hover:border-gray-400 hover:bg-gray-50',
  ghost:
    'border border-transparent bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900',
};

const sizeClasses: Record<ButtonSize, string> = {
  default: 'h-12 px-5 text-sm',
  sm: 'h-10 px-4 text-sm',
  lg: 'h-14 px-6 text-base',
};

export function buttonVariants({
  variant = 'primary',
  size = 'default',
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition duration-200 ease-out focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 disabled:pointer-events-none disabled:border-gray-400 disabled:bg-gray-400 disabled:text-white disabled:opacity-100',
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, leadingIcon, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={buttonVariants({ variant, size, className })}
      type={type}
      {...props}
    >
      {leadingIcon}
      {children}
    </button>
  );
});

Button.displayName = 'Button';
