import type { RoomMode, RoomRole, RoomStatus } from '@syncode/shared';
import { Badge, Button, Card } from '@syncode/ui';
import { AlertTriangle, Check, Copy, Crown, Loader2, Play } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useClipboard } from '@/hooks/use-clipboard.js';
import type { CollabConnectionStatus } from '@/hooks/use-yjs-collab.js';
import { allRequiredPeersReady } from '@/lib/participant-readiness.js';
import {
  buildInviteLink,
  countActiveRoleConfiguration,
  isRoomConfigurationValid,
} from '@/lib/room-stage.js';
import { LobbyBot } from './lobby-bot.js';
import { LobbyMediaPreview } from './lobby-media-preview.js';
import { type Participant, RoomParticipantCard } from './room-participant-card.js';

interface RoomLobbyProps {
  roomName: string | null;
  roomCode: string;
  roomId: string;
  mode: RoomMode;
  status: RoomStatus;
  hostId: string;
  currentUserId: string | null;
  participants: Participant[];
  canChangePhase: boolean;
  canManageParticipants: boolean;
  isTransitioning: boolean;
  isUpdatingRole: string | null;
  isTransferringOwnership: string | null;
  joinNotice: string | null;
  onParticipantRoleChange: (userId: string, role: RoomRole) => void;
  onTransferOwnership: (userId: string, displayName: string) => void;
  onToggleReady: () => void;
  onTransition: (targetStatus: RoomStatus) => void;
  speakingMap?: ReadonlyMap<string, boolean>;
  mediaConnectedSet?: ReadonlySet<string>;
  mediaMutedMap?: ReadonlyMap<string, boolean>;
  participantMediaControls?: {
    setVolume: (identity: string, volume: number) => void;
    setMuted: (identity: string, muted: boolean) => void;
    setVideoHidden: (identity: string, hidden: boolean) => void;
    volumeMap: ReadonlyMap<string, number>;
    muteSet: ReadonlySet<string>;
    videoHiddenSet: ReadonlySet<string>;
  };
  selfMicrophoneEnabled?: boolean;
  onSelfMicrophoneToggle?: () => void;
  mediaControls?: React.ReactNode;
  collabStatus?: CollabConnectionStatus;
}

const COLLAB_STATUS_INDICATOR: Record<
  CollabConnectionStatus,
  { dotClass: string; labelKey: string; fallback: string }
> = {
  connected: {
    dotClass: 'bg-success live-pulse',
    labelKey: 'statusBar.connected',
    fallback: 'Connected',
  },
  connecting: {
    dotClass: 'bg-warning animate-pulse',
    labelKey: 'statusBar.connecting',
    fallback: 'Connecting',
  },
  reconnecting: {
    dotClass: 'bg-warning animate-pulse',
    labelKey: 'statusBar.reconnecting',
    fallback: 'Reconnecting',
  },
  disconnected: {
    dotClass: 'bg-destructive',
    labelKey: 'statusBar.disconnected',
    fallback: 'Disconnected',
  },
};

export function RoomLobby({
  roomName,
  roomCode,
  roomId,
  mode,
  status,
  hostId,
  currentUserId,
  participants,
  canChangePhase,
  canManageParticipants,
  isTransitioning,
  isUpdatingRole,
  isTransferringOwnership,
  joinNotice,
  onParticipantRoleChange,
  onTransferOwnership,
  onToggleReady,
  onTransition,
  speakingMap,
  mediaConnectedSet,
  mediaMutedMap,
  participantMediaControls,
  selfMicrophoneEnabled,
  onSelfMicrophoneToggle,
  mediaControls,
  collabStatus,
}: RoomLobbyProps) {
  const { t } = useTranslation('rooms');
  const collabIndicator = collabStatus ? COLLAB_STATUS_INDICATOR[collabStatus] : null;
  const collabLabel = collabIndicator
    ? t(collabIndicator.labelKey, { defaultValue: collabIndicator.fallback })
    : null;
  const { copied, copy } = useClipboard();

  const activeParticipants = useMemo(() => participants.filter((p) => p.isActive), [participants]);
  const roleSummary = useMemo(
    () => countActiveRoleConfiguration(activeParticipants),
    [activeParticipants],
  );
  const isRoomValid = useMemo(
    () => isRoomConfigurationValid(mode, activeParticipants),
    [mode, activeParticipants],
  );

  const myRole = currentUserId
    ? (participants.find((p) => p.userId === currentUserId)?.role ?? 'observer')
    : 'observer';
  const readyCount = activeParticipants.filter((p) => p.isReady).length;
  const myReady = Boolean(
    currentUserId && activeParticipants.find((p) => p.userId === currentUserId)?.isReady,
  );
  const allPeersReady = useMemo(
    () => allRequiredPeersReady(participants, mode),
    [participants, mode],
  );
  const canEnterWorkspace =
    status === 'waiting' && canChangePhase && isRoomValid && myReady && allPeersReady;

  const inviteLink = buildInviteLink(roomId, roomCode);

  return (
    <div className="mx-auto max-w-5xl px-4 py-4 sm:py-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <LobbyBot
            readyCount={readyCount}
            totalCount={activeParticipants.length}
            className="mb-4"
          />
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {roomName ?? t('card.untitledRoom')}
          </h1>
          {collabIndicator && collabLabel ? (
            <output
              aria-live="polite"
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground"
            >
              <span className={`size-1.5 rounded-full ${collabIndicator.dotClass}`} />
              <span>{collabLabel}</span>
            </output>
          ) : null}
          <p className="mt-1 font-mono text-sm tracking-widest text-primary">
            {activeParticipants.length > 0
              ? `${readyCount} / ${activeParticipants.length} ${t('lobby.ready')}`
              : t('systemStatus.awaitingPeers')}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{t('lobby.sub')}</p>
          {joinNotice ? <p className="mt-2 text-sm text-primary">{joinNotice}</p> : null}
        </div>
      </motion.div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Participant grid */}
        <div className="lg:col-span-8 space-y-4">
          {mediaControls ? (
            <div className="sticky top-0 z-10 flex justify-center rounded-lg border border-border/60 bg-background/80 p-2 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              {mediaControls}
            </div>
          ) : null}
          <LobbyMediaPreview />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {activeParticipants.map((participant, index) => (
              <motion.div
                key={participant.userId}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.36,
                  delay: 0.1 + index * 0.06,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <RoomParticipantCard
                  participant={participant}
                  currentUserId={currentUserId}
                  roomHostId={hostId}
                  canManageParticipants={canManageParticipants}
                  isUpdatingRole={isUpdatingRole === participant.userId}
                  isTransferringOwnership={isTransferringOwnership === participant.userId}
                  isSpeaking={speakingMap?.get(participant.userId) ?? false}
                  isMediaConnected={mediaConnectedSet?.has(participant.userId) ?? false}
                  isMediaMuted={mediaMutedMap?.get(participant.userId) ?? false}
                  isLocallyMuted={
                    participantMediaControls?.muteSet.has(participant.userId) ?? false
                  }
                  isVideoHidden={
                    participantMediaControls?.videoHiddenSet.has(participant.userId) ?? false
                  }
                  localVolume={participantMediaControls?.volumeMap.get(participant.userId)}
                  isSelfMicrophoneEnabled={selfMicrophoneEnabled}
                  onSelfMicrophoneToggle={onSelfMicrophoneToggle}
                  onLocalMuteToggle={
                    participantMediaControls
                      ? (muted) => participantMediaControls.setMuted(participant.userId, muted)
                      : undefined
                  }
                  onLocalVolumeChange={
                    participantMediaControls
                      ? (vol) => participantMediaControls.setVolume(participant.userId, vol)
                      : undefined
                  }
                  onVideoHiddenToggle={
                    participantMediaControls
                      ? (hidden) =>
                          participantMediaControls.setVideoHidden(participant.userId, hidden)
                      : undefined
                  }
                  onRoleChange={onParticipantRoleChange}
                  onTransferOwnership={onTransferOwnership}
                />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          >
            <Card className="sticky top-6 rounded-xl p-5">
              <div className="space-y-4">
                {/* Invite link */}
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {t('success.shareLink').replace(':', '')}
                  </span>
                  <div className="mt-1.5 flex items-center gap-1.5 rounded-md border border-border/60 bg-background/70 px-2.5 py-1.5">
                    <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
                      {inviteLink}
                    </span>
                    <button
                      type="button"
                      aria-label={t('success.shareLink')}
                      onClick={() => copy(inviteLink)}
                      className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
                    >
                      {copied ? <Check size={13} className="text-primary" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>

                {/* My role + Room summary */}
                <div className="rounded-md border border-border/60 bg-muted/20 p-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {t('roleSelect.heading')}
                    </span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Badge variant={myRole} size="sm">
                        {t(`role.${myRole}`)}
                      </Badge>
                      {currentUserId === hostId ? (
                        <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] text-primary">
                          <Crown className="size-3" />
                          {t('role.host')}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="border-t border-border/40 pt-1.5 text-[11px] text-muted-foreground">
                    <div className="flex items-center justify-between gap-2">
                      <span className="shrink-0">{t(`status.${status}`)}</span>
                      <span className="truncate text-right">
                        {roleSummary.interviewerCount} {t('role.interviewer')} ·{' '}
                        {roleSummary.candidateCount} {t('role.candidate')} ·{' '}
                        {roleSummary.observerCount} {t('role.observer')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Ready toggle */}
                <Button
                  variant={myReady ? 'outline' : 'default'}
                  className="w-full"
                  onClick={onToggleReady}
                >
                  {myReady ? t('readyButton.cancelReady') : t('readyButton.ready')}
                </Button>

                {/* Enter workspace */}
                <div className="space-y-2 border-t border-border/60 pt-3">
                  {!isRoomValid ? (
                    <p className="flex items-start gap-1.5 text-[11px] leading-tight text-muted-foreground">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0 text-warning" />
                      {t(mode === 'ai' ? 'warningAi' : 'warning')}
                    </p>
                  ) : !myReady && canChangePhase ? (
                    <p className="text-[11px] text-muted-foreground">
                      {t('readyButton.readyFirst')}
                    </p>
                  ) : myReady && !allPeersReady && canChangePhase ? (
                    <p className="text-[11px] text-muted-foreground">
                      {t('hostControl.awaitingReady')}
                    </p>
                  ) : null}
                  <Button
                    disabled={!canEnterWorkspace || isTransitioning}
                    className="w-full"
                    onClick={() => onTransition('warmup')}
                  >
                    {isTransitioning ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Play size={16} className="fill-current" />
                    )}
                    {t('readyButton.enterWorkspace')}
                  </Button>
                  {!canChangePhase ? (
                    <p className="text-[11px] text-muted-foreground">
                      {t('lobby.awaitingController')}
                    </p>
                  ) : null}
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
