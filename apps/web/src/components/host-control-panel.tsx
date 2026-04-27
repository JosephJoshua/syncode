import { getNextStatuses, ROOM_STATUSES, type RoomStatus } from '@syncode/shared';
import { Button } from '@syncode/ui';
import {
  CheckCircle2,
  CirclePause,
  CirclePlay,
  Code2,
  FastForward,
  Loader2,
  PlayCircle,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatTimer, ROOM_STATUS_KEYS } from '@/lib/room-stage.js';
import { EditorLockToggle } from './editor-lock-toggle.js';

const TRANSITION_ICONS = {
  warmup: <PlayCircle className="size-3.5" />,
  coding: <Code2 className="size-3.5" />,
  wrapup: <FastForward className="size-3.5" />,
  finished: <CheckCircle2 className="size-3.5" />,
} as const satisfies Partial<Record<RoomStatus, ReactNode>>;

function PhaseProgressBar({ currentStatus }: { readonly currentStatus: RoomStatus }) {
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
  readonly currentStatus: RoomStatus;
  readonly elapsedMs: number;
  readonly timerPaused: boolean;
  readonly editorLocked: boolean;
  readonly canChangePhase: boolean;
  readonly canControlEditorLock: boolean;
  readonly isPending: boolean;
  readonly isLockingEditor: boolean;
  readonly isUnlockingEditor: boolean;
  readonly allRequiredReady: boolean;
  readonly onTransition: (targetStatus: RoomStatus) => void;
  readonly onLockEditor: () => void;
  readonly onUnlockEditor: () => void;
}

export function HostControlPanel({
  currentStatus,
  elapsedMs,
  timerPaused,
  editorLocked,
  canChangePhase,
  canControlEditorLock,
  isPending,
  isLockingEditor,
  isUnlockingEditor,
  allRequiredReady,
  onTransition,
  onLockEditor,
  onUnlockEditor,
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
          <EditorLockToggle
            locked={editorLocked}
            interactive={canControlEditorLock && currentStatus !== 'finished'}
            disabled={isPending || isLockingEditor || isUnlockingEditor}
            onLock={onLockEditor}
            onUnlock={onUnlockEditor}
          />
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
          {nextStages.map((stage) => {
            const readyGate = stage === 'warmup' && !allRequiredReady;
            const disabled = isPending || readyGate;

            return (
              <div key={stage} className="space-y-1">
                <Button
                  type="button"
                  variant={stage === 'finished' ? 'destructive' : 'default'}
                  size="sm"
                  className={`w-full justify-start gap-1.5 ${
                    stage !== 'finished' && !disabled ? 'shimmer-sweep' : ''
                  }`}
                  disabled={disabled}
                  title={readyGate ? t('hostControl.awaitingReady') : undefined}
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
                {readyGate ? (
                  <p className="text-[10px] text-muted-foreground">
                    {t('hostControl.awaitingReady')}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground">{t('hostControl.awaitingController')}</p>
      )}
    </div>
  );
}
