import type { ReactNode } from 'react';
import { MascotCharacter } from '@/routes/_public/-components/mascot-character';

interface AuthPageShellProps {
  readonly children: ReactNode;
  readonly color: 'cyan' | 'coral';
  readonly tagline: string;
}

export function AuthPageShell({ children, color, tagline }: AuthPageShellProps) {
  const bandBg = color === 'cyan' ? 'bg-cyan-band' : 'bg-coral-band';

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col lg:flex-row">
      {/* Colored brand panel — top on mobile, left on desktop */}
      <div
        className={`relative flex flex-col items-center justify-center gap-5 overflow-hidden py-14 lg:w-[45%] lg:py-0 ${bandBg}`}
      >
        {/* Ambient inner glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              color === 'cyan'
                ? 'radial-gradient(ellipse 60% 50% at 50% 45%, oklch(0.82 0.18 165 / 0.08), transparent)'
                : 'radial-gradient(ellipse 60% 50% at 50% 45%, oklch(0.72 0.19 35 / 0.08), transparent)',
          }}
        />

        <div className="relative z-10">
          <MascotCharacter color={color} size={150} mood="hover" trackCursor arms />
        </div>

        <h2 className="relative z-10 font-display text-3xl font-bold uppercase leading-[0.95] tracking-tight text-white lg:text-5xl xl:text-6xl">
          {tagline}
        </h2>
      </div>

      {/* Form area — bottom on mobile, right on desktop */}
      <div className="flex flex-1 items-center justify-center bg-ink px-4 py-12 sm:px-10 lg:py-0">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
