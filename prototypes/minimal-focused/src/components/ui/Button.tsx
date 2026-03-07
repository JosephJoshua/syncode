import type { ComponentPropsWithoutRef, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<ComponentPropsWithoutRef<'button'>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--accent)] text-[#09090b] font-semibold hover:bg-[var(--accent-hover)] hover:shadow-[var(--shadow-accent-glow)] active:scale-[0.97]',
  secondary:
    'border border-[var(--border-default)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]',
  ghost: 'bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-10 px-5 text-sm',
};

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  disabled,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-md transition-all duration-150 cursor-pointer font-medium ${variantStyles[variant]} ${sizeStyles[size]} ${disabled ? 'opacity-40 pointer-events-none' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
