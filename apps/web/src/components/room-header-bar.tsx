import type { RoomRole, RoomStatus } from '@syncode/shared';
import { Avatar, AvatarFallback, AvatarImage, Badge } from '@syncode/ui';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, Crown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatTimer, STAGE_THEME } from '@/lib/room-stage.js';
import type { Participant } from './room-participant-card.js';

const STAGE_ACCENT_CLASSES: Record<RoomStatus, string> = {
  waiting: '',
  warmup: 'stage-accent-warmup',
  coding: 'stage-accent-coding',
  wrapup: 'stage-accent-wrapup',
  finished: 'stage-accent-finished',
};

interface RoomHeaderBarProps {
  roomName: string | null;
  status: RoomStatus;
  myRole: RoomRole;
  isHost: boolean;
  elapsedMs: number;
  participants: Participant[];
}

export function RoomHeaderBar({
  roomName,
  status,
  myRole,
  isHost,
  elapsedMs,
  participants,
}: RoomHeaderBarProps) {
  const { t } = useTranslation('rooms');
  const isActive = status === 'coding' || status === 'warmup';
  const theme = STAGE_THEME[status];

  return (
    <header
      className={`flex h-10 shrink-0 items-center border-b border-border bg-background/95 px-3 backdrop-blur-sm ${STAGE_ACCENT_CLASSES[status]}`}
    >
      {/* Left: Back + Room name */}
      <div className="flex min-w-0 items-center gap-2">
        <Link
          to="/rooms"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft size={15} />
        </Link>
        <span className="truncate font-mono text-xs text-muted-foreground">
          {roomName ?? t('card.untitledRoom')}
        </span>
        {isHost ? <Crown className="size-3 shrink-0 text-primary" /> : null}
      </div>

      {/* Center: Stage badge + Timer */}
      <div className="flex flex-1 items-center justify-center gap-3">
        <div className="inline-flex items-center gap-1.5">
          <span
            className={`size-1.5 shrink-0 rounded-full ${theme.bg} ${isActive ? 'live-pulse' : ''}`}
          />
          <span className={`font-mono text-xs font-medium uppercase tracking-wider ${theme.text}`}>
            {t(`status.${status}`)}
          </span>
        </div>
        <span
          className={`font-mono text-sm font-semibold tabular-nums ${
            isActive ? 'text-primary' : 'text-foreground/70'
          }`}
        >
          {formatTimer(elapsedMs)}
        </span>
      </div>

      {/* Right: Participant stack + role */}
      <div className="flex shrink-0 items-center gap-2.5">
        <div className="flex items-center">
          {participants.slice(0, 4).map((p, i) => (
            <Avatar
              key={p.userId}
              className={`size-6 text-[9px] ring-2 ring-background ${i > 0 ? '-ml-1.5' : ''}`}
              style={{ zIndex: participants.length - i }}
            >
              {p.avatarUrl ? <AvatarImage src={p.avatarUrl} /> : null}
              <AvatarFallback className="bg-primary/10 text-primary">
                {(p.displayName ?? p.username).charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ))}
          {participants.length > 4 ? (
            <span className="-ml-1 z-0 flex size-6 items-center justify-center rounded-full border border-border bg-muted text-[9px] font-semibold text-muted-foreground ring-2 ring-background">
              +{participants.length - 4}
            </span>
          ) : null}
        </div>

        <Badge variant={myRole} size="sm">
          {t(`role.${myRole}`)}
        </Badge>
      </div>
    </header>
  );
}
