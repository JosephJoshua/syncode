import React from 'react';

// Five phases aligned with the API documentation
export type RoomPhase = 'waiting' | 'warmup' | 'coding' | 'wrapup' | 'finished';

interface RoomStageIndicatorProps {
  phase: RoomPhase;
  className?: string;
}

// Core config: phase-specific ASCII face, neon color, and glow style
const phaseConfig: Record<
  RoomPhase,
  { ascii: string; label: string; colorClass: string; glowClass: string }
> = {
  waiting: {
    ascii: '[ O _ O ]', // Wide-eyed waiting state
    label: 'AWAITING_SYNC',
    colorClass: 'text-zinc-400',
    glowClass: 'shadow-[0_0_10px_rgba(161,161,170,0.15)] border-zinc-800',
  },
  warmup: {
    ascii: '[ ? _ ? ]', // Thinking / ice-breaker phase
    label: 'SYSTEM_WARMUP',
    colorClass: 'text-amber-400',
    glowClass: 'shadow-[0_0_15px_rgba(251,191,36,0.25)] border-amber-500/40',
  },
  coding: {
    ascii: '[ > _ < ]', // Focused coding expression
    label: 'ACTIVE_CODING',
    // Use the neon green from the existing visual direction
    colorClass: 'text-[oklch(0.88_0.22_165)]',
    glowClass: 'shadow-[0_0_20px_oklch(0.88_0.22_165/0.35)] border-[oklch(0.88_0.22_165)]/50',
  },
  wrapup: {
    ascii: '[ = _ = ]', // Tired / wrap-up expression
    label: 'PHASE_WRAPUP',
    colorClass: 'text-fuchsia-400',
    glowClass: 'shadow-[0_0_15px_rgba(232,121,249,0.25)] border-fuchsia-500/40',
  },
  finished: {
    ascii: '[ ^ _ ^ ]', // Happy / completed state
    label: 'SESSION_END',
    colorClass: 'text-cyan-400',
    glowClass: 'shadow-[0_0_15px_rgba(34,211,238,0.25)] border-cyan-500/40',
  },
};

export function RoomStageIndicator({ phase, className = '' }: RoomStageIndicatorProps) {
  const config = phaseConfig[phase];

  return (
    <div
      className={`relative overflow-hidden inline-flex items-center gap-3.5 px-4 py-2.5 rounded-xl border bg-[#0a0a0a] transition-all duration-500 ${config.glowClass} ${className}`}
    >
      {/* CRT-style scanline overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_50%,transparent_50%)] bg-[length:100%_4px] pointer-events-none" />

      {/* ASCII pixel-style face */}
      <div
        className={`font-mono text-xl font-black tracking-widest ${config.colorClass} drop-shadow-[0_0_8px_currentColor] transition-colors duration-500`}
      >
        {config.ascii}
      </div>

      {/* Vertical divider */}
      <div className="w-px h-6 bg-zinc-800/80" />

      {/* Phase label */}
      <div
        className={`font-mono text-xs font-bold tracking-widest uppercase ${config.colorClass} drop-shadow-[0_0_5px_currentColor] transition-colors duration-500`}
      >
        {config.label}
      </div>
    </div>
  );
}
