import { getNextStatuses, ROOM_STATUSES, type RoomStatus } from '@syncode/shared';
import { Button } from '@syncode/ui';
import {
  CheckCircle2,
  CirclePause,
  CirclePlay,
  Code2,
  FastForward,
  Loader2,
  Lock,
  LockOpen,
  PlayCircle,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatTimer, ROOM_STATUS_KEYS } from '@/lib/room-stage.js';

const TRANSITION_ICONS = {
  warmup: <PlayCircle className="size-3.5" />,
  coding: <Code2 className="size-3.5" />,
  wrapup: <FastForward className="size-3.5" />,
  finished: <CheckCircle2 className="size-3.5" />,
} as const satisfies Partial<Record<RoomStatus, ReactNode>>;

function PhaseProgressBar({ currentStatus }: { currentStatus: RoomStatus }) {
  const { t } = useTranslation('rooms');
  const currentIndex = ROOM_STATUSES.indexOf(currentStatus);

  return (
    <div className="flex items-center gap-0.5">
      {ROOM_STATUSES.map((status, index) => {
        const completed = index < currentIndex;
        const active = index === currentIndex;

        return (
          <div key={status} className="flex flex-1 flex-col items-center gap-1">
            <div
              className={`h-1.5 w-full rounded-full transition-all duration-500 ${
                active
                  ? 'bg-primary shadow-[0_0_10px_oklch(0.82_0.18_165/0.4)] animate-glow-pulse'
                  : completed
                    ? 'bg-primary/50'
                    : 'bg-border'
              }`}
            />
            <span
              className={`font-mono text-[8px] ${
                active ? 'text-primary' : completed ? 'text-primary/50' : 'text-muted-foreground/40'
              }`}
            >
              {t(ROOM_STATUS_KEYS[status])}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface HostControlPanelProps {
  currentStatus: RoomStatus;
  elapsedMs: number;
  timerPaused: boolean;
  editorLocked: boolean;
  canChangePhase: boolean;
  isRoomValid: boolean;
  isPending: boolean;
  onTransition: (targetStatus: RoomStatus) => void;
}

export function HostControlPanel({
  currentStatus,
  elapsedMs,
  timerPaused,
  editorLocked,
  canChangePhase,
  isRoomValid,
  isPending,
  onTransition,
}: HostControlPanelProps) {
  const { t } = useTranslation('rooms');
  const nextStages = getNextStatuses(currentStatus);

  return (
    <div className="space-y-3">
      {/* Phase progress */}
      <PhaseProgressBar currentStatus={currentStatus} />

      {/* Timer + Status row */}
      <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/50 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
            {formatTimer(elapsedMs)}
          </span>
          {timerPaused ? (
            <CirclePause className="size-3.5 text-warning" />
          ) : (
            <CirclePlay className="size-3.5 text-primary live-pulse" />
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[10px]">
          {editorLocked ? (
            <span className="flex items-center gap-1 font-mono text-warning">
              <Lock size={10} />
              {t('lobby.editorLocked')}
            </span>
          ) : (
            <span className="flex items-center gap-1 font-mono text-muted-foreground/60">
              <LockOpen size={10} />
              {t('lobby.editorUnlocked')}
            </span>
          )}
        </div>
      </div>

      {/* Stage transition buttons */}
      {currentStatus === 'finished' ? (
        <div className="rounded-md border border-border/60 bg-background/50 px-3 py-2.5 text-center text-xs text-muted-foreground">
          <CheckCircle2 className="mx-auto mb-1.5 size-5 text-primary" />
          {t('hostControl.sessionConcluded')}
        </div>
      ) : canChangePhase ? (
        <div className="space-y-1.5">
          {nextStages.map((stage) => (
            <Button
              key={stage}
              type="button"
              variant={stage === 'finished' ? 'destructive' : 'default'}
              size="sm"
              className={`w-full justify-start gap-1.5 ${
                stage !== 'finished' && !isPending ? 'shimmer-sweep' : ''
              }`}
              disabled={isPending || (stage === 'warmup' && !isRoomValid)}
              onClick={() => onTransition(stage)}
            >
              {isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                TRANSITION_ICONS[stage as keyof typeof TRANSITION_ICONS]
              )}
              {stage === 'finished'
                ? t('hostControl.endSession')
                : t('hostControl.advanceTo', { stageName: t(ROOM_STATUS_KEYS[stage]) })}
            </Button>
          ))}
          {!isRoomValid && currentStatus === 'waiting' ? (
            <p className="text-[10px] text-warning">{t('warning')}</p>
          ) : null}
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground">{t('hostControl.awaitingController')}</p>
      )}
    </div>
  );
}
