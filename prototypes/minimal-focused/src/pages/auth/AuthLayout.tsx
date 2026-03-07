import type { ReactNode } from 'react';
import { Link } from 'react-router';

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] px-4 relative">
      {/* Dot grid background */}
      <div className="absolute inset-0 pointer-events-none dot-grid" style={{ opacity: 0.08 }} />

      {/* Back to home */}
      <Link
        to="/"
        className="absolute top-4 left-4 font-mono text-xs text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors z-10"
      >
        ← home
      </Link>

      <div className="max-w-sm w-full relative z-[1]">
        <Link
          to="/"
          className="block font-display text-xl font-bold text-[var(--text-primary)] text-center mb-8 tracking-tight hover:opacity-80 transition-opacity"
        >
          <span className="text-[var(--accent)]">Syn</span>Code
        </Link>
        <div className="bg-[var(--bg-raised)] border border-[var(--border-default)] rounded-lg p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
