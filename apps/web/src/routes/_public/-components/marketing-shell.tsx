import { useRouterState } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { MarketingFooter } from './marketing-footer';

export function MarketingShell({ children }: { readonly children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isLanding = pathname === '/';

  return (
    <div data-surface="marketing" className="min-h-screen">
      {children}
      {isLanding ? <MarketingFooter /> : null}
    </div>
  );
}
