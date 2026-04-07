import type { ReactNode } from 'react';
import { GlowOrb, PageBackground } from '@/components/background.js';
import { FloatingSymbols } from '@/components/floating-symbols.js';
import { CursorSpotlight } from '@/components/spotlight.js';

/**
 * Shared visual chrome for login and register pages.
 */
export function AuthPageShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
      <PageBackground />
      <FloatingSymbols />
      <CursorSpotlight />

      <GlowOrb className="left-1/2 top-1/4 -translate-x-1/2 -translate-y-1/2 animate-[glowPulse_4s_ease-in-out_infinite]" />
      <GlowOrb
        className="left-1/3 top-2/3 -translate-x-1/2 animate-[glowPulse_6s_ease-in-out_infinite_1s]"
        size="sm"
      />

      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}
