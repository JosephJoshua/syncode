import type { RoomRole, RoomStatus } from '@syncode/shared';
import { Command, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatTimer, STAGE_THEME } from '@/lib/room-stage.js';

interface RoomStatusBarProps {
  status: RoomStatus;
  myRole: RoomRole;
  elapsedMs: number;
  editorLocked: boolean;
  participantCount: number;
}

export function RoomStatusBar({
  status,
  myRole,
  elapsedMs,
  editorLocked,
  participantCount,
}: RoomStatusBarProps) {
  const { t } = useTranslation('rooms');

  return (
    <footer className="flex h-7 shrink-0 items-center border-t border-border bg-background text-[10px]">
      <div className={`h-full w-1 shrink-0 ${STAGE_THEME[status].bg}`} />

      <div className="flex flex-1 items-center px-2.5">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-success live-pulse" />
            <span className="font-mono text-muted-foreground">{t('statusBar.connected')}</span>
          </span>
          <span className="text-border">|</span>
          <span className="font-mono text-muted-foreground">
            {participantCount} {t('statusBar.participants')}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {editorLocked ? (
            <span className="flex items-center gap-1 font-mono text-warning">
              <Lock size={10} />
              {t('lobby.editorLocked')}
            </span>
          ) : null}
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
