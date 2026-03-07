import { Check, ChevronRight } from 'lucide-react';

type Stage = 'waiting' | 'warmup' | 'coding' | 'wrapup' | 'finished';

const stages: { key: Stage; label: string; color: string }[] = [
  { key: 'waiting', label: 'Waiting', color: '#9B95B0' },
  { key: 'warmup', label: 'Warmup', color: '#FF9F1C' },
  { key: 'coding', label: 'Coding', color: '#FF5A5F' },
  { key: 'wrapup', label: 'Wrapup', color: '#FFB347' },
  { key: 'finished', label: 'Finished', color: '#2EC4B6' },
];

interface StageBarProps {
  currentStage: Stage;
  onAdvance?: () => void;
  compact?: boolean;
}

export function StageBar({ currentStage, onAdvance, compact = false }: StageBarProps) {
  const currentIdx = stages.findIndex((s) => s.key === currentStage);

  return (
    <div className="flex items-center gap-1.5">
      {stages.map((stage, idx) => {
        const isCompleted = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isFuture = idx > currentIdx;

        return (
          <div key={stage.key} className="flex items-center gap-1.5">
            {idx > 0 && (
              <div
                className="h-0.5 rounded-full"
                style={{
                  width: compact ? 12 : 20,
                  backgroundColor: isCompleted ? stages[idx - 1].color : 'var(--bg-subtle)',
                }}
              />
            )}
            <span
              className={`inline-flex items-center gap-1 rounded-full font-medium transition-all duration-300 ${
                compact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'
              }`}
              style={{
                backgroundColor: isFuture ? 'var(--bg-subtle)' : stage.color,
                color: isFuture ? 'var(--text-tertiary)' : '#fff',
                animation: isCurrent ? 'pulse-ring 2s ease-in-out infinite' : undefined,
              }}
            >
              {isCompleted && <Check size={compact ? 10 : 12} />}
              {stage.label}
            </span>
          </div>
        );
      })}

      {onAdvance && (
        <button
          type="button"
          onClick={onAdvance}
          className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-[var(--bg-subtle)] px-2 py-1 text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-raised)] transition-colors cursor-pointer"
          title="Next Stage (dev)"
        >
          Next <ChevronRight size={10} />
        </button>
      )}
    </div>
  );
}
