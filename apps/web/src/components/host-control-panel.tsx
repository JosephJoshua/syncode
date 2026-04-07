import { getNextStatuses, ROOM_STATUSES, RoomStatus } from '@syncode/shared';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@syncode/ui';
import { CheckCircle2, Code2, FastForward, Pause, Play, PlayCircle } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const ROOM_STATUS_KEYS: Record<RoomStatus, string> = {
  [RoomStatus.WAITING]: 'status.waiting',
  [RoomStatus.WARMUP]: 'status.warmup',
  [RoomStatus.CODING]: 'status.coding',
  [RoomStatus.WRAPUP]: 'status.wrapup',
  [RoomStatus.FINISHED]: 'status.finished',
};

const PHASE_COUNT = ROOM_STATUSES.length;

function PhaseProgressBar({ currentStatus }: { currentStatus: RoomStatus }) {
  const { t } = useTranslation('rooms');
  const currentIndex = ROOM_STATUSES.indexOf(currentStatus);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1">
        {ROOM_STATUSES.map((status, i) => {
          const isCompleted = i < currentIndex;
          const isActive = i === currentIndex;

          return (
            <div
              key={status}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: `${100 / PHASE_COUNT}%`,
                backgroundColor: isCompleted
                  ? 'var(--color-primary)'
                  : isActive
                    ? 'var(--color-primary)'
                    : 'var(--color-muted)',
                opacity: isCompleted ? 0.5 : isActive ? 1 : 0.3,
                animation: isActive ? 'var(--animate-glow-pulse)' : 'none',
              }}
            />
          );
        })}
      </div>
      <span className="text-xs text-muted-foreground">
        {currentIndex + 1}/{PHASE_COUNT} &middot; {t(ROOM_STATUS_KEYS[currentStatus])}
      </span>
    </div>
  );
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Mock max duration in ms (120 minutes). */
const MOCK_MAX_DURATION_MS = 120 * 60 * 1000;
const WARNING_THRESHOLD = 0.85;

function PhaseTimer({ running }: { running: boolean }) {
  const { t } = useTranslation('rooms');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const ticking = running && !paused;

  useEffect(() => {
    if (ticking) {
      intervalRef.current = setInterval(() => {
        setElapsedMs((prev) => prev + 1000);
      }, 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [ticking]);

  const togglePause = useCallback(() => setPaused((p) => !p), []);

  const ratio = elapsedMs / MOCK_MAX_DURATION_MS;
  const warning = ratio >= WARNING_THRESHOLD;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span
          className={`font-mono text-lg tabular-nums ${warning ? 'text-destructive' : 'text-foreground'}`}
          style={warning ? { animation: 'var(--animate-glow-pulse)' } : undefined}
        >
          {formatTime(elapsedMs)}
        </span>
        {warning && (
          <span className="text-xs text-destructive font-medium">
            {t('timer.percent', { percent: Math.round(ratio * 100) })}
          </span>
        )}
      </div>

      {running && (
        <Button
          variant="ghost"
          size="xs"
          onClick={togglePause}
          aria-label={paused ? t('timer.resumeTimer') : t('timer.pauseTimer')}
        >
          {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
        </Button>
      )}
    </div>
  );
}

const TRANSITION_ICONS: Partial<Record<RoomStatus, ReactNode>> = {
  [RoomStatus.WARMUP]: <PlayCircle className="mr-2 h-4 w-4" />,
  [RoomStatus.CODING]: <Code2 className="mr-2 h-4 w-4" />,
  [RoomStatus.WRAPUP]: <FastForward className="mr-2 h-4 w-4" />,
  [RoomStatus.FINISHED]: <CheckCircle2 className="mr-2 h-4 w-4" />,
};

export function HostControlPanel() {
  const { t } = useTranslation('rooms');
  const [currentStage, setCurrentStage] = useState<RoomStatus>(RoomStatus.WAITING);
  const nextStages = getNextStatuses(currentStage);

  const handleTransition = (target: RoomStatus) => {
    // TODO: Replace with react-query mutation (POST /rooms/{roomId}/control/transition) once Issue #114 is merged.
    setCurrentStage(target);
  };

  const timerRunning = currentStage !== RoomStatus.WAITING && currentStage !== RoomStatus.FINISHED;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-lg">{t('hostControl.heading')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <PhaseProgressBar currentStatus={currentStage} />
        <PhaseTimer key={currentStage} running={timerRunning} />

        {currentStage === RoomStatus.FINISHED ? (
          <div className="text-center py-4 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>{t('hostControl.sessionConcluded')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">{t('hostControl.advanceStage')}</p>
            {nextStages.map((stage) => (
              <Button
                key={stage}
                variant={stage === RoomStatus.FINISHED ? 'destructive' : 'default'}
                className="w-full justify-start"
                onClick={() => handleTransition(stage)}
              >
                {TRANSITION_ICONS[stage]}
                {stage === RoomStatus.FINISHED
                  ? t('hostControl.endSession')
                  : t('hostControl.advanceTo', { stageName: t(ROOM_STATUS_KEYS[stage]) })}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
