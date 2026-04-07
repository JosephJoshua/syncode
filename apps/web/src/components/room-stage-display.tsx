import type { RoomStatus } from '@syncode/shared';
import { useTranslation } from 'react-i18next';

interface RoomStageIndicatorProps {
  phase: RoomStatus;
  className?: string;
}

const phaseConfig: Record<
  RoomStatus,
  { ascii: string; labelKey: string; colorClass: string; glowClass: string }
> = {
  waiting: {
    ascii: '[ O _ O ]',
    labelKey: 'stage.awaitingSync',
    colorClass: 'text-muted-foreground',
    glowClass: 'border-border',
  },
  warmup: {
    ascii: '[ ? _ ? ]',
    labelKey: 'stage.systemWarmup',
    colorClass: 'text-amber-400',
    glowClass: 'shadow-[0_0_15px_rgba(251,191,36,0.25)] border-amber-500/40',
  },
  coding: {
    ascii: '[ > _ < ]',
    labelKey: 'stage.activeCoding',
    colorClass: 'text-primary',
    glowClass: 'shadow-[0_0_20px_hsl(var(--primary)/0.35)] border-primary/50',
  },
  wrapup: {
    ascii: '[ = _ = ]',
    labelKey: 'stage.phaseWrapup',
    colorClass: 'text-fuchsia-400',
    glowClass: 'shadow-[0_0_15px_rgba(232,121,249,0.25)] border-fuchsia-500/40',
  },
  finished: {
    ascii: '[ ^ _ ^ ]',
    labelKey: 'stage.sessionEnd',
    colorClass: 'text-cyan-400',
    glowClass: 'shadow-[0_0_15px_rgba(34,211,238,0.25)] border-cyan-500/40',
  },
};

export function RoomStageIndicator({ phase, className = '' }: RoomStageIndicatorProps) {
  const { t } = useTranslation('rooms');
  const config = phaseConfig[phase];

  return (
    <div
      className={`relative inline-flex items-center gap-3.5 overflow-hidden rounded-xl border bg-card px-4 py-2.5 transition-all duration-500 ${config.glowClass} ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_50%,transparent_50%)] bg-[length:100%_4px]" />

      <div
        className={`font-mono text-xl font-black tracking-widest drop-shadow-[0_0_8px_currentColor] transition-colors duration-500 ${config.colorClass}`}
      >
        {config.ascii}
      </div>

      <div className="h-6 w-px bg-border" />

      <div
        className={`font-mono text-xs font-bold uppercase tracking-widest drop-shadow-[0_0_5px_currentColor] transition-colors duration-500 ${config.colorClass}`}
      >
        {t(config.labelKey)}
      </div>
    </div>
  );
}
