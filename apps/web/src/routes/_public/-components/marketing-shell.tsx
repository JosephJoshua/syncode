import type { ReactNode } from 'react';
import { MarketingFooter } from './marketing-footer';

/**
 * MarketingShell — wraps every page served under the `_public` route.
 *
 * Sets `data-surface="marketing"` on the outermost div so that the marketing
 * token overrides defined in `_public/-styles/marketing.css` activate.
 * Renders the marketing footer after children on every public route.
 */
export function MarketingShell({ children }: { readonly children: ReactNode }) {
  return (
    <div data-surface="marketing" className="min-h-screen">
      {children}
      <MarketingFooter />
    </div>
  );
}
