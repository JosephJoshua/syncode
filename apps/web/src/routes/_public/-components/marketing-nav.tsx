import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { SynCodeLogo } from '@/components/syncode-logo.js';

interface MarketingNavProps {
  readonly actions: ReactNode;
}

/**
 * MarketingNav -- MetaMask-inspired floating pill navigation bar.
 *
 * Desktop: floating dark rounded-pill bar with logo+wordmark left, actions right.
 * Mobile (<640px): collapses to logo + compact actions.
 * Uses `header-entrance` CSS class for the delayed slide-in animation.
 */
export function MarketingNav({ actions }: MarketingNavProps) {
  return (
    <header className="header-entrance fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4 sm:px-6 sm:pt-5">
      <nav className="flex w-full max-w-5xl items-center justify-between gap-4 rounded-full border border-white/5 bg-charcoal/60 px-4 py-2 shadow-lg-flat backdrop-blur-xl sm:px-6 sm:py-2.5">
        {/* Logo + wordmark */}
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2 font-semibold text-foreground transition-colors hover:text-primary"
        >
          <SynCodeLogo className="size-6" />
          <span className="text-sm tracking-tight sm:text-base">SynCode</span>
        </Link>

        {/* Actions (auth-state-dependent) */}
        <div className="flex items-center gap-2 text-sm sm:gap-3">{actions}</div>
      </nav>
    </header>
  );
}
