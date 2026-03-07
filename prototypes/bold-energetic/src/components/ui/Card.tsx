import type { CSSProperties, ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: string;
  onClick?: () => void;
  style?: CSSProperties;
}

export function Card({ children, className = '', padding = 'p-5', onClick, style }: CardProps) {
  const base = `bg-[var(--bg-card)] rounded-xl border border-[var(--border-default)] shadow-[var(--shadow-sm)] transition-all duration-200 ${padding} ${className}`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} cursor-pointer hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] hover:border-[var(--primary-light)] text-left w-full`}
        style={style}
      >
        {children}
      </button>
    );
  }

  return (
    <div className={base} style={style}>
      {children}
    </div>
  );
}
