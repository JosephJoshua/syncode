import { CONTROL_API, ERROR_CODES } from '@syncode/contracts';
import { getNextStatuses, type RoomRole, type RoomStatus } from '@syncode/shared';
import { Button, Card, Input, Select, SelectContent, SelectItem, SelectTrigger } from '@syncode/ui';
import { createFileRoute } from '@tanstack/react-router';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  Loader2,
  Play,
  UserCog,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LobbyBot } from '@/components/lobby-bot.js';
import { useClipboard } from '@/hooks/use-clipboard.js';
import { api, readApiError } from '@/lib/api-client.js';
import { useAuthStore } from '@/stores/auth.store.js';

export const Route = createFileRoute('/_app/rooms/$roomId')({
  component: RoomLobbyPage,
});

type RoomDetail = Awaited<ReturnType<typeof api<typeof CONTROL_API.ROOMS.GET>>>;
type JoinResponse = Awaited<ReturnType<typeof api<typeof CONTROL_API.ROOMS.JOIN>>>;

const ROLE_LABEL_KEYS: Record<RoomRole, string> = {
  candidate: 'role.candidate',
  interviewer: 'role.interviewer',
  observer: 'role.observer',
};

const ASSIGNABLE_ROLES: Array<{ value: RoomRole; labelKey: string }> = [
  { value: 'candidate', labelKey: 'roleSelect.candidate' },
  { value: 'interviewer', labelKey: 'roleSelect.interviewer' },
  { value: 'observer', labelKey: 'roleSelect.observer' },
];

function RoomLobbyPage() {
  const { t } = useTranslation('rooms');
  const { roomId } = Route.useParams();
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [isJoining, setIsJoining] = useState(true);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinNotice, setJoinNotice] = useState<string | null>(null);
  const [readyMap, setReadyMap] = useState<Record<string, boolean>>({});
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [inviteLink] = useState(() => window.location.href);
  const { copied, copy } = useClipboard();

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadRoom = async () => {
      setIsJoining(true);
      setJoinError(null);
      setJoinNotice(null);

      try {
        const url = new URL(window.location.href);
        const roomCode = url.searchParams.get('code')?.toUpperCase();

        if (roomCode) {
          const joined = await api(CONTROL_API.ROOMS.JOIN, {
            params: { id: roomId },
            body: { roomCode },
          });
          setRoom(joined.room);
          setJoinNotice(buildJoinNotice(joined, t));
        } else {
          const detail = await api(CONTROL_API.ROOMS.GET, { params: { id: roomId } });
          setRoom(detail);
        }
      } catch (error) {
        const apiError = await readApiError(error);
        setJoinError(resolveJoinError(apiError, t));
      } finally {
        setIsJoining(false);
      }
    };

    void loadRoom();
  }, [roomId, t]);

  const myRole = room?.myRole ?? 'candidate';
  const amHost = Boolean(room && currentUserId && room.hostId === currentUserId);
  const canChangePhase = room?.myCapabilities.includes('room:change-phase') ?? false;
  const participants = room?.participants ?? [];
  const nextStages = room ? getNextStatuses(room.status as RoomStatus) : [];

  const {
    allReady,
    readyCount,
    totalCount,
    isRoomValid,
    interviewerCount,
    candidateCount,
    elapsedMs,
  } = useMemo(() => {
    const readyCountValue = participants.filter(
      (participant) => readyMap[participant.userId],
    ).length;
    const interviewerCountValue = participants.filter(
      (participant) => participant.isActive && participant.role === 'interviewer',
    ).length;
    const candidateCountValue = participants.filter(
      (participant) => participant.isActive && participant.role === 'candidate',
    ).length;

    const dynamicElapsedMs =
      room?.status === 'coding' && room.currentPhaseStartedAt && !room.timerPaused
        ? room.elapsedMs + Math.max(0, now - new Date(room.currentPhaseStartedAt).getTime())
        : (room?.elapsedMs ?? 0);

    return {
      allReady: readyCountValue === participants.length && participants.length > 0,
      readyCount: readyCountValue,
      totalCount: participants.length,
      isRoomValid: interviewerCountValue === 1 && candidateCountValue === 1,
      interviewerCount: interviewerCountValue,
      candidateCount: candidateCountValue,
      elapsedMs: dynamicElapsedMs,
    };
  }, [participants, readyMap, room, now]);

  const toggleReady = () => {
    if (!currentUserId) return;
    setReadyMap((current) => ({
      ...current,
      [currentUserId]: !current[currentUserId],
    }));
  };

  const copyInviteLink = () => copy(inviteLink);

  const handleParticipantRoleChange = async (participantUserId: string, role: RoomRole) => {
    setIsUpdatingRole(participantUserId);

    try {
      const response = await api(CONTROL_API.ROOMS.UPDATE_PARTICIPANT, {
        params: { id: roomId, participantUserId },
        body: { role },
      });

      setRoom(response.room);
    } catch (error) {
      const apiError = await readApiError(error);
      setJoinError(apiError?.message ?? t('lobby.roleUpdateFailed'));
    } finally {
      setIsUpdatingRole(null);
    }
  };

  const handleTransition = async (targetStatus: RoomStatus) => {
    setIsTransitioning(true);

    try {
      await api(CONTROL_API.ROOMS.TRANSITION_PHASE, {
        params: { id: roomId },
        body: { targetStatus },
      });

      const detail = await api(CONTROL_API.ROOMS.GET, { params: { id: roomId } });
      setRoom(detail);
    } catch (error) {
      const apiError = await readApiError(error);
      setJoinError(apiError?.message ?? t('lobby.transitionFailed'));
    } finally {
      setIsTransitioning(false);
    }
  };

  if (joinError && !room) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:py-12">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <AlertTriangle size={42} className="mb-4 text-warning" />
          <h2 className="text-xl font-bold tracking-wide text-foreground">
            {t('lobby.unableToJoin')}
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">{joinError}</p>
        </div>
      </div>
    );
  }

  if (isJoining || !room) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:py-12">
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 size={48} className="mb-6 animate-spin text-primary" />
          <h2 className="text-xl font-bold uppercase tracking-widest text-muted-foreground">
            {t('lobby.connecting')}
          </h2>
          <p className="mt-2 font-mono text-sm text-muted-foreground">
            {t('lobby.authenticating', { roomId: roomId.slice(0, 8) })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex flex-col items-center text-center">
          <LobbyBot readyCount={readyCount} totalCount={totalCount} className="mb-5" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t('lobby.heading')}
          </h1>
          <p className="mt-2 font-mono text-sm tracking-widest text-primary">
            {totalCount > 0
              ? `${readyCount} / ${totalCount} ${t('lobby.ready')}`
              : t('systemStatus.awaitingPeers')}
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">{t('lobby.sub')}</p>
          {joinNotice ? <p className="mt-3 text-sm text-primary">{joinNotice}</p> : null}
          {joinError ? <p className="mt-2 text-sm text-warning">{joinError}</p> : null}
        </div>
      </motion.div>

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {participants.map((participant, index) => {
              const displayName = participant.displayName ?? participant.username;
              const isMe = participant.userId === currentUserId;
              const isParticipantHost = participant.userId === room.hostId;

              return (
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
                  <Card className="rounded-xl border-border/60 bg-card/80 p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-lg font-bold text-foreground">
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
                            {isMe ? `${displayName} ${t('lobby.you')}` : displayName}
                            {isParticipantHost ? (
                              <span className="rounded bg-foreground px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-background">
                                {t('role.host')}
                              </span>
                            ) : null}
                          </span>

                          {amHost && participant.userId !== room.hostId ? (
                            <Select
                              value={participant.role}
                              onValueChange={(value) =>
                                void handleParticipantRoleChange(
                                  participant.userId,
                                  value as RoomRole,
                                )
                              }
                            >
                              <SelectTrigger className="mt-1 h-7 w-auto gap-1.5 border-none bg-transparent px-0 py-0 text-sm font-mono text-primary shadow-none ring-0 focus-visible:ring-0">
                                <UserCog size={14} />
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
                            <span className="mt-1 flex items-center gap-1.5 font-mono text-sm text-primary">
                              <UserCog size={14} />
                              {t(ROLE_LABEL_KEYS[participant.role])}
                            </span>
                          )}
                        </div>
                      </div>

                      {readyMap[participant.userId] ? (
                        <CheckCircle2 size={24} className="shrink-0 text-primary" />
                      ) : isUpdatingRole === participant.userId ? (
                        <Loader2 size={24} className="shrink-0 animate-spin text-primary" />
                      ) : (
                        <Circle size={24} className="shrink-0 text-muted-foreground/40" />
                      )}
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          >
            <Card className="sticky top-6 rounded-xl p-7">
              <div className="space-y-7">
                <div className="space-y-2.5">
                  <label
                    htmlFor="invite-link"
                    className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
                  >
                    {t('common:copyLink')}
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="invite-link"
                      type="text"
                      readOnly
                      value={inviteLink}
                      className="font-mono text-sm"
                    />
                    <Button type="button" variant="outline" size="icon" onClick={copyInviteLink}>
                      {copied ? <Check size={16} className="text-primary" /> : <Copy size={16} />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {t('roleSelect.heading')}
                  </span>
                  <div className="flex h-11 items-center gap-2 rounded-lg border border-input bg-background px-4 text-sm font-medium text-muted-foreground">
                    <UserCog size={16} />
                    <span>{t(ROLE_LABEL_KEYS[myRole])}</span>
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('status.' + room.status)}</span>
                    <span className="font-mono text-foreground">{formatTime(elapsedMs)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {t('lobby.roleBalance', {
                        interviewers: interviewerCount,
                        candidates: candidateCount,
                      })}
                    </span>
                    <span>
                      {room.editorLocked ? t('lobby.editorLocked') : t('lobby.editorUnlocked')}
                    </span>
                  </div>
                  {canChangePhase ? (
                    <div className="flex flex-col gap-2">
                      {nextStages.map((stage) => (
                        <Button
                          key={stage}
                          type="button"
                          variant={stage === 'finished' ? 'destructive' : 'default'}
                          disabled={isTransitioning || (stage === 'warmup' && !isRoomValid)}
                          onClick={() => void handleTransition(stage as RoomStatus)}
                        >
                          {isTransitioning ? <Loader2 size={16} className="animate-spin" /> : null}
                          {t('hostControl.advanceTo', { stageName: t(`status.${stage}`) })}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <Button
                  variant={readyMap[currentUserId ?? ''] ? 'outline' : 'default'}
                  size="lg"
                  className="w-full"
                  onClick={toggleReady}
                >
                  {readyMap[currentUserId ?? '']
                    ? t('readyButton.cancelReady')
                    : t('readyButton.ready')}
                </Button>

                {allReady ? (
                  <div className="space-y-3 border-t border-border/60 pt-5">
                    {!isRoomValid ? (
                      <p className="flex items-start gap-2 text-xs text-muted-foreground">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warning" />
                        {t('warning')}
                      </p>
                    ) : null}
                    <Button size="lg" disabled={!isRoomValid} className="w-full">
                      <Play
                        size={18}
                        className={isRoomValid ? 'fill-current' : 'fill-current opacity-50'}
                      />
                      {t('readyButton.enterWorkspace')}
                    </Button>
                  </div>
                ) : null}
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function buildJoinNotice(
  joined: JoinResponse,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  const roleLabel = t(ROLE_LABEL_KEYS[joined.assignedRole]);

  if (joined.assignmentReason === 'requested') {
    return t('lobby.requestedRoleAssigned', { role: roleLabel });
  }

  if (joined.assignmentReason === 'fallback-observer') {
    return t('lobby.fallbackObserver');
  }

  return t('lobby.autoAssigned', { role: roleLabel });
}

const JOIN_ERROR_KEYS: Partial<Record<string, string>> = {
  [ERROR_CODES.ROOM_NOT_FOUND]: 'lobby.roomNotFound',
  [ERROR_CODES.ROOM_FULL]: 'lobby.roomFull',
  [ERROR_CODES.ROOM_FINISHED]: 'lobby.roomFinished',
  [ERROR_CODES.ROOM_INVALID_CODE]: 'lobby.invalidCode',
  [ERROR_CODES.ROOM_ACCESS_DENIED]: 'lobby.accessDenied',
  [ERROR_CODES.ROOM_PERMISSION_DENIED]: 'lobby.accessDenied',
  [ERROR_CODES.ROOM_INVITE_CODE_EXHAUSTED]: 'lobby.invalidCode',
  [ERROR_CODES.ROOM_ROLE_UNAVAILABLE]: 'lobby.roleUnavailable',
};

function resolveJoinError(
  apiError: Awaited<ReturnType<typeof readApiError>>,
  t: (key: string) => string,
): string {
  if (!apiError) return t('lobby.joinFailed');

  const i18nKey = apiError.code ? JOIN_ERROR_KEYS[apiError.code] : undefined;
  if (i18nKey) return t(i18nKey);

  return apiError.message || t('lobby.joinFailed');
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
