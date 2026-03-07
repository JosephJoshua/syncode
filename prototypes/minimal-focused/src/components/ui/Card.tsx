import type { CSSProperties, ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: string;
  onClick?: () => void;
  style?: CSSProperties;
}

export function Card({ children, className = '', padding = 'p-5', onClick, style }: CardProps) {
  return (
    <div
      className={`bg-[var(--bg-raised)] border border-[var(--border-default)] rounded-lg transition-all duration-150 ${padding} ${onClick ? 'hover:-translate-y-px hover:shadow-[var(--shadow-sm)] hover:border-[var(--border-strong)] cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      style={style}
    >
      {children}
    </div>
  );
}
