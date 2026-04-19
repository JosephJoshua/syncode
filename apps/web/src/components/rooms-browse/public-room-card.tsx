import {
  BROWSEABLE_ROOM_STATUSES,
  type BrowseableRoomStatus,
  type PublicRoomSummary,
} from '@syncode/contracts';
import type { ProblemDifficulty } from '@syncode/shared';
import { Avatar, AvatarFallback, AvatarImage, Badge, Button, Card, cn } from '@syncode/ui';
import { formatDistanceToNowStrict } from 'date-fns';
import { Clock3, Code2, Loader2, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_SELECTOR_METADATA } from '@/components/language-selector.data.js';
import { ROOM_STATUS_KEYS, ROOM_STATUS_STYLES } from '@/lib/room-stage.js';

const DIFFICULTY_KEYS: Record<ProblemDifficulty, string> = {
  easy: 'problems:detail.easy',
  medium: 'problems:detail.medium',
  hard: 'problems:detail.hard',
};

const DIFFICULTY_STYLES: Record<ProblemDifficulty, string> = {
  easy: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  medium: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  hard: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
};

type Props = {
  room: PublicRoomSummary;
  index: number;
  onJoin: (roomId: string) => void;
  isJoining: boolean;
};

export function PublicRoomCard({ room, index, onJoin, isJoining }: Props) {
  const { t } = useTranslation('rooms');

  const statusStyle = BROWSEABLE_ROOM_STATUSES.includes(room.status as BrowseableRoomStatus)
    ? ROOM_STATUS_STYLES[room.status]
    : { dot: 'bg-muted-foreground/50', badge: 'border-border bg-muted/30 text-muted-foreground' };

  const statusKey = ROOM_STATUS_KEYS[room.status] ?? `status.${room.status}`;

  const hostInitial = (room.hostName ?? '?').charAt(0).toUpperCase();
  const isFull = room.participantCount >= room.maxParticipants;

  return (
    <motion.li
      className="list-none"
      initial={{ opacity: 0, y: 16, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.36, delay: Math.min(index * 0.04, 0.32), ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="group relative flex h-full flex-col gap-4 rounded-2xl border border-white/[0.035] bg-card/50 p-5 ring-1 ring-border/30 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:bg-card/70 hover:shadow-[0_20px_40px_-24px_color-mix(in_oklch,var(--primary)_70%,transparent)] hover:ring-primary/20 sm:p-6">
        <div className="flex items-center justify-between">
          <Badge
            variant="outline"
            className={cn('gap-1.5 px-2.5 py-1 text-[11px] font-medium', statusStyle.badge)}
          >
            <span className={cn('inline-block size-1.5 rounded-full', statusStyle.dot)} />
            {t(statusKey)}
          </Badge>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
            <Clock3 size={12} />
            {formatDistanceToNowStrict(new Date(room.createdAt), { addSuffix: true })}
          </span>
        </div>

        <div>
          <h3 className="text-base font-semibold leading-snug tracking-tight text-foreground transition-colors group-hover:text-primary sm:text-lg">
            {room.problemTitle ?? t('browse.card.unknownProblem')}
          </h3>
          {room.name && (
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{room.name}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {room.problemDifficulty && (
            <Badge
              variant="outline"
              className={cn(
                'px-2 py-0.5 text-[11px] font-medium',
                DIFFICULTY_STYLES[room.problemDifficulty],
              )}
            >
              {t(DIFFICULTY_KEYS[room.problemDifficulty])}
            </Badge>
          )}
          {room.language && (
            <Badge variant="outline" className="gap-1 px-2 py-0.5 text-[11px] font-medium">
              <Code2 size={10} />
              {LANGUAGE_SELECTOR_METADATA[room.language].label}
            </Badge>
          )}
          <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-[11px] font-medium">
            <Users size={10} />
            {t('browse.card.participantFraction', {
              current: room.participantCount,
              max: room.maxParticipants,
            })}
          </Badge>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/40 pt-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar className="size-8 border border-border/60">
              {room.hostAvatarUrl ? (
                <AvatarImage src={room.hostAvatarUrl} alt={room.hostName} />
              ) : null}
              <AvatarFallback className="text-xs">{hostInitial}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-xs font-medium text-foreground">{room.hostName}</span>
              <span className="truncate text-[10px] uppercase tracking-wider text-muted-foreground/70">
                {t('browse.card.hostedBy', { name: room.hostName })}
              </span>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={isJoining || isFull}
            onClick={() => onJoin(room.roomId)}
            className="shrink-0 gap-1.5"
          >
            {isJoining ? <Loader2 size={14} className="animate-spin" /> : null}
            {t('browse.card.join')}
          </Button>
        </div>
      </Card>
    </motion.li>
  );
}
