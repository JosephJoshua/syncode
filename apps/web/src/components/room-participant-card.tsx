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
import { CheckCircle2, Crown, EllipsisVertical, Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ROLE_LABEL_KEYS } from '@/lib/room-stage.js';

const ASSIGNABLE_ROLES: Array<{ value: RoomRole; labelKey: string }> = [
  { value: 'candidate', labelKey: 'roleSelect.candidate' },
  { value: 'interviewer', labelKey: 'roleSelect.interviewer' },
  { value: 'observer', labelKey: 'roleSelect.observer' },
];

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
  onRoleChange?: (userId: string, role: RoomRole) => void;
  onTransferOwnership?: (userId: string, displayName: string) => void;
  onRemoveParticipant?: (userId: string, displayName: string) => void;
  /** Compact mode for the workspace sidebar (no avatar, single line) */
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
  const showParticipantActions = Boolean(
    canManageParticipants && !isHost && (onTransferOwnership || onRemoveParticipant),
  );
  const [isParticipantMenuOpen, setIsParticipantMenuOpen] = useState(false);

  if (compact) {
    return (
      <div className="group flex items-center gap-2.5 py-2">
        <Avatar className="size-6 text-[9px]">
          {participant.avatarUrl ? <AvatarImage src={participant.avatarUrl} /> : null}
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-sm text-foreground">
            {displayName}
            {isMe ? <span className="ml-1 text-xs text-primary">{t('lobby.you')}</span> : null}
          </span>
          {isHost ? <Crown className="size-3 shrink-0 text-primary" /> : null}
          {participant.isReady ? (
            <CheckCircle2 className="size-3 shrink-0 text-emerald-400" />
          ) : null}
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
                  className="min-w-40 rounded-xl border-border/60"
                >
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
        <Avatar className="size-9 shrink-0">
          {participant.avatarUrl ? <AvatarImage src={participant.avatarUrl} /> : null}
          <AvatarFallback className="text-sm">{initial}</AvatarFallback>
        </Avatar>

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
            {canManageParticipants && (!isHost || isMe) ? (
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
              <Badge variant={participant.role}>{t(ROLE_LABEL_KEYS[participant.role])}</Badge>
            )}

            {isUpdatingRole ? <Loader2 className="size-3.5 animate-spin text-primary" /> : null}
          </div>
        </div>

        {canManageParticipants && !isHost && onTransferOwnership ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="shrink-0 text-[11px] text-muted-foreground"
            disabled={isTransferringOwnership}
            onClick={() => onTransferOwnership(participant.userId, displayName)}
          >
            {isTransferringOwnership ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Crown className="size-3" />
            )}
            {t('workspace.transferOwnership')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
