import type { RoomRole } from '@syncode/shared';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@syncode/ui';
import {
  CheckCircle2,
  Crown,
  EllipsisVertical,
  Loader2,
  MicOff,
  Signal,
  SignalLow,
  SignalMedium,
  Trash2,
  VideoOff,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ROLE_LABEL_KEYS } from '@/lib/room-stage.js';

const ASSIGNABLE_ROLES: Array<{ value: RoomRole; labelKey: string }> = [
  { value: 'candidate', labelKey: 'roleSelect.candidate' },
  { value: 'interviewer', labelKey: 'roleSelect.interviewer' },
  { value: 'observer', labelKey: 'roleSelect.observer' },
];

function PresenceDot({
  isMediaConnected,
  isMediaMuted,
  isActive,
  size = 'sm',
}: {
  isMediaConnected: boolean;
  isMediaMuted: boolean;
  isActive: boolean;
  size?: 'sm' | 'md';
}) {
  if (isMediaConnected && isMediaMuted) {
    const cls =
      size === 'sm'
        ? 'absolute -bottom-1 -right-1 flex size-3 items-center justify-center rounded-full border border-card bg-destructive/90'
        : 'absolute -bottom-1 -right-1 flex size-3.5 items-center justify-center rounded-full border-2 border-card bg-destructive/90';
    const iconCls = size === 'sm' ? 'size-1.5 text-white' : 'size-2 text-white';
    return (
      <span className={cls}>
        <MicOff className={iconCls} />
      </span>
    );
  }
  return (
    <span
      className={cn(
        'absolute rounded-full',
        size === 'sm'
          ? '-bottom-0.5 -right-0.5 size-2 border border-card'
          : '-bottom-0.5 -right-0.5 size-2.5 border-2 border-card',
        isMediaConnected
          ? 'bg-emerald-400'
          : isActive
            ? 'bg-muted-foreground/50'
            : 'bg-muted-foreground/20',
      )}
    />
  );
}

function MediaActionsContent({
  isLocallyMuted,
  isVideoHidden,
  localVolume,
  onLocalMuteToggle,
  onLocalVolumeChange,
  onVideoHiddenToggle,
}: {
  isLocallyMuted: boolean;
  isVideoHidden: boolean;
  localVolume?: number;
  onLocalMuteToggle?: (muted: boolean) => void;
  onLocalVolumeChange?: (volume: number) => void;
  onVideoHiddenToggle?: (hidden: boolean) => void;
}) {
  return (
    <>
      {onLocalMuteToggle ? (
        <DropdownMenuItem onSelect={() => onLocalMuteToggle(!isLocallyMuted)}>
          {isLocallyMuted ? (
            <Volume2 className="size-3.5 text-muted-foreground" />
          ) : (
            <VolumeX className="size-3.5 text-muted-foreground" />
          )}
          {isLocallyMuted ? 'Unmute for me' : 'Mute for me'}
        </DropdownMenuItem>
      ) : null}
      {onLocalVolumeChange ? (
        <div className="flex min-h-9 items-center gap-2 px-3 py-2">
          <Volume2 className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={localVolume ?? 1}
            onChange={(e) => onLocalVolumeChange(Number(e.target.value))}
            className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
            onClick={(e) => e.stopPropagation()}
          />
          <span className="w-6 text-right font-mono text-[9px] text-muted-foreground/60">
            {Math.round((localVolume ?? 1) * 100)}
          </span>
        </div>
      ) : null}
      {onVideoHiddenToggle ? (
        <DropdownMenuItem onSelect={() => onVideoHiddenToggle(!isVideoHidden)}>
          <VideoOff className="size-3.5 text-muted-foreground" />
          {isVideoHidden ? 'Show video' : 'Hide video'}
        </DropdownMenuItem>
      ) : null}
    </>
  );
}

function ConnectionQualityIcon({ quality }: { quality?: string }) {
  if (!quality) return null;
  switch (quality) {
    case 'excellent':
      return <Signal className="size-3 text-emerald-400" />;
    case 'good':
      return <SignalMedium className="size-3 text-amber-400" />;
    case 'poor':
    case 'lost':
      return <SignalLow className="size-3 text-destructive" />;
    default:
      return null;
  }
}

export interface Participant {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: RoomRole;
  isActive: boolean;
  isReady: boolean;
}

interface RoomParticipantCardProps {
  participant: Participant;
  currentUserId: string | null;
  roomHostId: string;
  canManageParticipants: boolean;
  isUpdatingRole: boolean;
  isTransferringOwnership: boolean;
  isRemovingParticipant?: boolean;
  rolesLocked?: boolean;
  isSpeaking?: boolean;
  isMediaConnected?: boolean;
  isMediaMuted?: boolean;
  connectionQuality?: string;
  isLocallyMuted?: boolean;
  isVideoHidden?: boolean;
  localVolume?: number;
  onLocalMuteToggle?: (muted: boolean) => void;
  onLocalVolumeChange?: (volume: number) => void;
  onVideoHiddenToggle?: (hidden: boolean) => void;
  onRoleChange?: (userId: string, role: RoomRole) => void;
  onTransferOwnership?: (userId: string, displayName: string) => void;
  onRemoveParticipant?: (userId: string, displayName: string) => void;
  compact?: boolean;
}

export function RoomParticipantCard({
  participant,
  currentUserId,
  roomHostId,
  canManageParticipants,
  isUpdatingRole,
  isTransferringOwnership,
  isRemovingParticipant = false,
  rolesLocked = false,
  isSpeaking = false,
  isMediaConnected = false,
  isMediaMuted = false,
  connectionQuality,
  isLocallyMuted = false,
  isVideoHidden = false,
  localVolume,
  onLocalMuteToggle,
  onLocalVolumeChange,
  onVideoHiddenToggle,
  onRoleChange,
  onTransferOwnership,
  onRemoveParticipant,
  compact = false,
}: RoomParticipantCardProps) {
  const { t } = useTranslation('rooms');
  const displayName = participant.displayName ?? participant.username;
  const isMe = participant.userId === currentUserId;
  const isHost = participant.userId === roomHostId;
  const initial = displayName.charAt(0).toUpperCase();
  const hasManageActions =
    canManageParticipants && !isHost && (onTransferOwnership || onRemoveParticipant);
  const hasMediaActions = !isMe && isMediaConnected && (onLocalMuteToggle || onVideoHiddenToggle);
  const showParticipantActions = Boolean(hasManageActions || hasMediaActions);
  const [isParticipantMenuOpen, setIsParticipantMenuOpen] = useState(false);

  if (compact) {
    return (
      <div className="group flex items-center gap-2.5 py-2">
        <div className="relative">
          <Avatar
            className={cn('size-6 text-[9px] transition-shadow', isSpeaking && 'speaking-ring')}
          >
            {participant.avatarUrl ? <AvatarImage src={participant.avatarUrl} /> : null}
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
          <PresenceDot
            isMediaConnected={isMediaConnected}
            isMediaMuted={isMediaMuted}
            isActive={participant.isActive}
            size="sm"
          />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-sm text-foreground">
            {displayName}
            {isMe ? <span className="ml-1 text-xs text-primary">{t('lobby.you')}</span> : null}
          </span>
          {isHost ? <Crown className="size-3 shrink-0 text-primary" /> : null}
          {participant.isReady ? (
            <CheckCircle2 className="size-3 shrink-0 text-emerald-400" />
          ) : null}
          <ConnectionQualityIcon quality={connectionQuality} />
        </div>
        <div className="flex shrink-0 items-center justify-end gap-1.5">
          <div
            className={cn(
              'flex items-center gap-1.5 transition-transform duration-200 ease-out',
              showParticipantActions &&
                (isParticipantMenuOpen
                  ? '-translate-x-0.5'
                  : 'group-hover:-translate-x-0.5 group-focus-within:-translate-x-0.5'),
            )}
          >
            <Badge variant={participant.role} className="text-[10px]">
              {t(ROLE_LABEL_KEYS[participant.role])}
            </Badge>
            {isUpdatingRole ? (
              <Loader2 className="size-3 animate-spin text-muted-foreground" />
            ) : null}
          </div>
          {showParticipantActions ? (
            <div
              className={cn(
                'overflow-hidden transition-all duration-200 ease-out',
                isParticipantMenuOpen ? 'w-6' : 'w-0 group-hover:w-6 group-focus-within:w-6',
              )}
            >
              <DropdownMenu open={isParticipantMenuOpen} onOpenChange={setIsParticipantMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className={cn(
                      'size-6 text-muted-foreground transition-all duration-200 ease-out',
                      isParticipantMenuOpen
                        ? 'translate-x-0 opacity-100'
                        : 'opacity-0 group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100',
                    )}
                    aria-label={t('workspace.participantActions')}
                  >
                    <EllipsisVertical className="size-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  side="bottom"
                  className="min-w-44 rounded-xl border-border/60"
                >
                  {hasMediaActions ? (
                    <MediaActionsContent
                      isLocallyMuted={isLocallyMuted}
                      isVideoHidden={isVideoHidden}
                      localVolume={localVolume}
                      onLocalMuteToggle={onLocalMuteToggle}
                      onLocalVolumeChange={onLocalVolumeChange}
                      onVideoHiddenToggle={onVideoHiddenToggle}
                    />
                  ) : null}
                  {hasManageActions ? (
                    <>
                      <DropdownMenuItem
                        disabled={isTransferringOwnership || isRemovingParticipant}
                        onSelect={() => onTransferOwnership?.(participant.userId, displayName)}
                      >
                        {isTransferringOwnership ? (
                          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                        ) : (
                          <Crown className="size-3.5 text-muted-foreground" />
                        )}
                        {t('workspace.transferOwnership')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={
                          !onRemoveParticipant || isTransferringOwnership || isRemovingParticipant
                        }
                        onSelect={() => onRemoveParticipant?.(participant.userId, displayName)}
                      >
                        {isRemovingParticipant ? (
                          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                        ) : (
                          <Trash2 className="size-3.5 text-muted-foreground" />
                        )}
                        {t('workspace.removeParticipant')}
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/80 p-3">
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <Avatar className={cn('size-9 transition-shadow', isSpeaking && 'speaking-ring')}>
            {participant.avatarUrl ? <AvatarImage src={participant.avatarUrl} /> : null}
            <AvatarFallback className="text-sm">{initial}</AvatarFallback>
          </Avatar>
          <PresenceDot
            isMediaConnected={isMediaConnected}
            isMediaMuted={isMediaMuted}
            isActive={participant.isActive}
            size="md"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-foreground">{displayName}</span>
            {isMe ? (
              <span className="shrink-0 text-[10px] font-normal text-primary">
                {t('lobby.you')}
              </span>
            ) : null}
            {isHost ? (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-primary/25 bg-primary/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-primary">
                <Crown className="size-2.5" />
                {t('role.host')}
              </span>
            ) : null}
            {participant.isReady ? (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-emerald-400">
                <CheckCircle2 className="size-2.5" />
                {t('lobby.ready')}
              </span>
            ) : null}
          </div>

          <div className="mt-1.5 flex items-center gap-2">
            {canManageParticipants && (!isHost || isMe) && !rolesLocked ? (
              <Select
                value={participant.role}
                onValueChange={(value) => onRoleChange?.(participant.userId, value as RoomRole)}
              >
                <SelectTrigger className="h-7 w-auto min-w-[120px] gap-1 border-border/60 bg-background/60 px-2 text-xs font-mono shadow-none">
                  {t(ROLE_LABEL_KEYS[participant.role])}
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_ROLES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Badge
                variant={participant.role}
                title={rolesLocked ? t('workspace.rolesLocked') : undefined}
              >
                {t(ROLE_LABEL_KEYS[participant.role])}
              </Badge>
            )}

            {isUpdatingRole ? <Loader2 className="size-3.5 animate-spin text-primary" /> : null}
          </div>
        </div>

        {showParticipantActions ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="size-7 shrink-0 text-muted-foreground"
              >
                <EllipsisVertical className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44 rounded-xl border-border/60">
              {hasMediaActions ? (
                <MediaActionsContent
                  isLocallyMuted={isLocallyMuted}
                  isVideoHidden={isVideoHidden}
                  localVolume={localVolume}
                  onLocalMuteToggle={onLocalMuteToggle}
                  onLocalVolumeChange={onLocalVolumeChange}
                  onVideoHiddenToggle={onVideoHiddenToggle}
                />
              ) : null}
              {hasManageActions ? (
                <>
                  <DropdownMenuItem
                    disabled={isTransferringOwnership}
                    onSelect={() => onTransferOwnership?.(participant.userId, displayName)}
                  >
                    {isTransferringOwnership ? (
                      <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                    ) : (
                      <Crown className="size-3.5 text-muted-foreground" />
                    )}
                    {t('workspace.transferOwnership')}
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}
