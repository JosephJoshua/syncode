import type { RoomRole, RoomStatus } from '@syncode/shared';
import { Command, Lock, LockOpen, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CollabConnectionStatus } from '@/hooks/use-yjs-collab.js';
import { formatTimer, STAGE_THEME } from '@/lib/room-stage.js';

interface RoomStatusBarProps {
  readonly status: RoomStatus;
  readonly myRole: RoomRole;
  readonly elapsedMs: number;
  readonly editorLocked: boolean;
  readonly participantCount: number;
  readonly collabStatus: CollabConnectionStatus;
}

const STATUS_INDICATOR: Record<CollabConnectionStatus, { dotClass: string; labelKey: string }> = {
  connected: { dotClass: 'bg-success live-pulse', labelKey: 'statusBar.connected' },
  connecting: { dotClass: 'bg-warning animate-pulse', labelKey: 'statusBar.connecting' },
  reconnecting: { dotClass: 'bg-warning animate-pulse', labelKey: 'statusBar.reconnecting' },
  disconnected: { dotClass: 'bg-destructive', labelKey: 'statusBar.disconnected' },
};

export function RoomStatusBar({
  status,
  myRole,
  elapsedMs,
  editorLocked,
  participantCount,
  collabStatus,
}: RoomStatusBarProps) {
  const { t } = useTranslation('rooms');

  const indicator = STATUS_INDICATOR[collabStatus];

  return (
    <footer className="flex h-7 shrink-0 items-center border-t border-border bg-background text-[10px]">
      <div className={`h-full w-1 shrink-0 ${STAGE_THEME[status].bg}`} />

      <div className="flex flex-1 items-center px-2.5">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5">
            <span className={`size-1.5 rounded-full ${indicator.dotClass}`} />
            <span className="font-mono text-muted-foreground">{t(indicator.labelKey)}</span>
          </span>
          {collabStatus === 'reconnecting' || collabStatus === 'disconnected' ? (
            <WifiOff size={10} className="text-warning" />
          ) : null}
          <span className="text-border">|</span>
          <span className="font-mono text-muted-foreground">
            {participantCount} {t('statusBar.participants')}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span
            className={
              editorLocked
                ? 'flex items-center gap-1 font-mono text-warning'
                : 'flex items-center gap-1 font-mono text-muted-foreground/70'
            }
          >
            {editorLocked ? <Lock size={10} /> : <LockOpen size={10} />}
            {editorLocked ? t('lobby.editorLocked') : t('lobby.editorUnlocked')}
          </span>
          <span className="font-mono text-muted-foreground">
            {t(`status.${status}`)} &middot; {formatTimer(elapsedMs)} {t('statusBar.elapsed')}
          </span>
          <span className="font-mono text-primary">{t(`role.${myRole}`)}</span>
          <span className="hidden items-center gap-0.5 font-mono text-muted-foreground/50 sm:flex">
            <Command size={9} />
            <span>Enter {t('workspace.runCode')}</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
