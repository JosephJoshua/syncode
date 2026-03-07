import type { ComponentPropsWithoutRef, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<ComponentPropsWithoutRef<'button'>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'gradient-brand text-white font-semibold hover:shadow-[var(--shadow-glow-primary)] active:scale-[0.97]',
  secondary:
    'bg-[var(--bg-card)] text-[var(--primary)] border border-[var(--primary-light)] hover:bg-[var(--primary-muted)]',
  ghost: 'bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]',
  danger: 'bg-[var(--error)] text-white hover:opacity-90',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-5 text-sm',
  lg: 'h-12 px-7 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer ${variantStyles[variant]} ${sizeStyles[size]} ${disabled ? 'opacity-40 pointer-events-none' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
