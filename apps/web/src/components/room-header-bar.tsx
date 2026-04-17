import type { RoomRole, RoomStatus } from '@syncode/shared';
import { Avatar, AvatarFallback, AvatarImage, Badge, cn } from '@syncode/ui';
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
  speakingMap?: ReadonlyMap<string, boolean>;
  mediaControls?: React.ReactNode;
  mediaConnectedSet?: ReadonlySet<string>;
}

export function RoomHeaderBar({
  roomName,
  status,
  myRole,
  isHost,
  elapsedMs,
  participants,
  speakingMap,
  mediaControls,
  mediaConnectedSet,
}: RoomHeaderBarProps) {
  const { t } = useTranslation('rooms');
  const isActive = status === 'coding' || status === 'warmup';
  const theme = STAGE_THEME[status];

  return (
    <header
      className={`flex h-10 shrink-0 items-center border-b border-border bg-background/95 px-3 backdrop-blur-sm ${STAGE_ACCENT_CLASSES[status]}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Link
          to="/rooms"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft size={15} />
        </Link>
        <span className="hidden truncate font-mono text-xs text-muted-foreground sm:inline">
          {roomName ?? t('card.untitledRoom')}
        </span>
        {isHost ? <Crown className="size-3 shrink-0 text-primary" /> : null}
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-2 sm:gap-3">
        <div className="inline-flex items-center gap-1.5">
          <span
            className={`size-1.5 shrink-0 rounded-full ${theme.bg} ${isActive ? 'live-pulse' : ''}`}
          />
          <span
            className={`hidden font-mono text-xs font-medium uppercase tracking-wider sm:inline ${theme.text}`}
          >
            {t(`status.${status}`)}
          </span>
        </div>
        <span
          className={`font-mono text-xs font-semibold tabular-nums sm:text-sm ${
            isActive ? 'text-primary' : 'text-foreground/70'
          }`}
        >
          {formatTimer(elapsedMs)}
        </span>
      </div>

      {/* Right */}
      <div className="flex shrink-0 items-center gap-2.5">
        {mediaControls}

        <div className="flex items-center">
          {participants.slice(0, 4).map((p, i) => (
            <div
              key={p.userId}
              className={cn('relative', i > 0 && '-ml-1.5')}
              style={{ zIndex: participants.length - i }}
            >
              <Avatar
                className={cn(
                  'size-6 text-[9px] ring-2 ring-background transition-shadow',
                  speakingMap?.get(p.userId) && 'speaking-ring',
                )}
              >
                {p.avatarUrl ? <AvatarImage src={p.avatarUrl} /> : null}
                <AvatarFallback className="bg-primary/10 text-primary">
                  {(p.displayName ?? p.username).charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span
                className={cn(
                  'absolute -bottom-0.5 -right-0.5 size-1.5 rounded-full border border-background',
                  mediaConnectedSet?.has(p.userId)
                    ? 'bg-emerald-400'
                    : p.isActive
                      ? 'bg-muted-foreground/50'
                      : 'bg-muted-foreground/20',
                )}
              />
            </div>
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
