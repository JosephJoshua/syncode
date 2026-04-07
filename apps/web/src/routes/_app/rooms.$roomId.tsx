import { CONTROL_API, ERROR_CODES } from '@syncode/contracts';
import type { RoomRole } from '@syncode/shared';
import {
  Button,
  Card,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@syncode/ui';
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

type Participant = {
  id: string;
  username: string;
  isReady: boolean;
  isHost: boolean;
  role: RoomRole;
};

const ROLE_LABEL_KEYS: Record<string, string> = {
  host: 'role.host',
  candidate: 'role.candidate',
  interviewer: 'role.interviewer',
  spectator: 'role.observer',
};

/** Roles that can be assigned to non-host participants. */
const ASSIGNABLE_ROLES: Array<{ value: RoomRole; labelKey: string }> = [
  { value: 'candidate', labelKey: 'roleSelect.candidate' },
  { value: 'interviewer', labelKey: 'roleSelect.interviewer' },
  { value: 'spectator', labelKey: 'roleSelect.observer' },
];

function RoomLobbyPage() {
  const { t } = useTranslation('rooms');
  const { roomId } = Route.useParams();
  const currentUserId = useAuthStore((state) => state.user?.id);

  const [isJoining, setIsJoining] = useState(true);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [myRole, setMyRole] = useState<RoomRole>('candidate');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [inviteLink] = useState(() => window.location.href);
  const { copied, copy } = useClipboard();

  useEffect(() => {
    const joinRoom = async () => {
      setIsJoining(true);
      setJoinError(null);
      setParticipants([]);

      const applyDetail = (
        detail: Awaited<ReturnType<typeof api<typeof CONTROL_API.ROOMS.GET>>>,
        resolvedRole: RoomRole,
      ) => {
        setParticipants(
          detail.participants.map((participant) => {
            const baseName = participant.displayName ?? participant.username;
            const isMe = participant.userId === currentUserId;
            return {
              id: participant.userId,
              username: isMe ? `${baseName} ${t('lobby.you')}` : baseName,
              isReady: false,
              isHost: participant.role === 'host',
              role: participant.role,
            };
          }),
        );
        setMyRole(resolvedRole);
      };

      try {
        const url = new URL(window.location.href);
        const roomCode = url.searchParams.get('code')?.toUpperCase();

        if (roomCode) {
          const joined = await api(CONTROL_API.ROOMS.JOIN, {
            params: { id: roomId },
            body: { roomCode },
          });

          applyDetail(joined.room, joined.assignedRole);
        } else {
          const detail = await api(CONTROL_API.ROOMS.GET, {
            params: { id: roomId },
          });
          applyDetail(detail, detail.myRole);
        }

        setIsJoining(false);
      } catch (error) {
        const apiError = await readApiError(error);

        if (apiError?.code === ERROR_CODES.ROOM_ALREADY_JOINED) {
          try {
            const detail = await api(CONTROL_API.ROOMS.GET, {
              params: { id: roomId },
            });

            applyDetail(detail, detail.myRole);
            setJoinError(null);
            setIsJoining(false);
            return;
          } catch {
            // Fall through to error state below.
          }
        }

        setJoinError(resolveJoinError(apiError, t));
        setIsJoining(false);
      }
    };
    joinRoom();
  }, [roomId, currentUserId, t]);

  const amHost = myRole === 'host';

  const handleParticipantRoleChange = (participantId: string, newRole: string) => {
    const role = newRole as RoomRole;
    setParticipants((prev) => prev.map((p) => (p.id === participantId ? { ...p, role } : p)));
  };

  const toggleReady = () => {
    const newReadyState = !isReady;
    setIsReady(newReadyState);

    setParticipants((prev) =>
      prev.map((p) => (p.id === currentUserId ? { ...p, isReady: newReadyState } : p)),
    );
  };

  const copyInviteLink = () => copy(inviteLink);

  const { allReady, readyCount, totalCount, isRoomValid } = useMemo(() => {
    const ready = participants.filter((p) => p.isReady).length;
    const total = participants.length;
    const every = ready === total && total > 0;

    const hasCandidate = participants.some((p) => p.role === 'candidate');
    // Host has all interviewer capabilities, so they count as an interviewer
    const hasInterviewer = participants.some((p) => p.role === 'interviewer' || p.role === 'host');

    return {
      allReady: every,
      readyCount: ready,
      totalCount: total,
      isRoomValid: hasCandidate && hasInterviewer,
    };
  }, [participants]);

  const glowIntensity = totalCount > 0 ? readyCount / totalCount : 0;

  if (joinError) {
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

  if (isJoining) {
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
      {/* Bot + heading section */}
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
          <p
            className={`mt-2 font-mono text-sm tracking-widest ${
              allReady ? 'text-primary' : 'animate-pulse text-primary/50'
            }`}
          >
            {totalCount > 0
              ? `${readyCount} / ${totalCount} ${t('lobby.ready')}`
              : t('systemStatus.awaitingPeers')}
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">{t('lobby.sub')}</p>
        </div>
      </motion.div>

      {/* Main grid: participants + sidebar */}
      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Participant cards */}
        <div className="lg:col-span-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {participants.map((participant, index) => (
              <motion.div
                key={participant.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.36,
                  delay: 0.1 + index * 0.06,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <Card
                  className={`rounded-xl p-5 transition-all duration-300 ${
                    participant.isReady
                      ? 'border-primary/40 bg-card shadow-[0_0_20px_hsl(var(--primary)/0.15)]'
                      : 'border-border/60 bg-card/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        {participant.isReady && (
                          <span className="absolute inset-0 animate-[glowPulse_2s_ease-in-out_infinite] rounded-full border-2 border-primary/60" />
                        )}
                        <div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-lg font-bold text-foreground">
                          {participant.username.charAt(0).toUpperCase()}
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <span className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
                          {participant.username}
                          {participant.isHost && (
                            <span className="rounded bg-foreground px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-background">
                              {t('role.host')}
                            </span>
                          )}
                        </span>

                        {/* Host can assign roles to non-host participants */}
                        {amHost && !participant.isHost ? (
                          <Select
                            value={participant.role}
                            onValueChange={(v) => handleParticipantRoleChange(participant.id, v)}
                          >
                            <SelectTrigger className="mt-1 h-7 w-auto gap-1.5 border-none bg-transparent px-0 py-0 text-sm font-mono text-primary shadow-none ring-0 focus-visible:ring-0">
                              <UserCog size={14} />
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ASSIGNABLE_ROLES.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {t(opt.labelKey)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="mt-1 flex items-center gap-1.5 font-mono text-sm text-primary">
                            <UserCog size={14} />
                            {t(ROLE_LABEL_KEYS[participant.role] ?? participant.role)}
                          </span>
                        )}
                      </div>
                    </div>
                    {participant.isReady ? (
                      <CheckCircle2 size={24} className="shrink-0 text-primary" />
                    ) : (
                      <Circle size={24} className="shrink-0 text-muted-foreground/40" />
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Control panel sidebar */}
        <div className="lg:col-span-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          >
            <Card
              className="sticky top-6 rounded-xl p-7 transition-shadow duration-500"
              style={{
                boxShadow:
                  glowIntensity > 0
                    ? `0 0 ${16 + glowIntensity * 24}px hsl(var(--primary) / ${0.08 + glowIntensity * 0.22})`
                    : undefined,
              }}
            >
              <div className="space-y-7">
                {/* Invite link */}
                <div className="space-y-2.5">
                  <label
                    htmlFor="invite-link"
                    className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
                  >
                    {t('common:copyLink')}
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="invite-link"
                        type="text"
                        readOnly
                        value={inviteLink}
                        className="w-full font-mono text-sm"
                      />
                      <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card to-transparent" />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={copyInviteLink}
                      title={t('common:copyLink')}
                    >
                      {copied ? <Check size={16} className="text-primary" /> : <Copy size={16} />}
                    </Button>
                  </div>
                </div>

                {/* Your role */}
                <div className="space-y-2.5">
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {t('roleSelect.heading')}
                  </span>
                  {amHost ? (
                    <div className="flex h-11 items-center gap-2 rounded-lg border border-input bg-background px-4 text-sm font-medium">
                      <UserCog size={16} className="text-primary" />
                      <span>{t('roleSelect.host')}</span>
                    </div>
                  ) : (
                    <div className="flex h-11 items-center gap-2 rounded-lg border border-input bg-background px-4 text-sm font-medium text-muted-foreground">
                      <UserCog size={16} />
                      <span>{t(ROLE_LABEL_KEYS[myRole] ?? myRole)}</span>
                    </div>
                  )}
                </div>

                {/* Ready / Cancel button */}
                <Button
                  variant={isReady ? 'outline' : 'default'}
                  size="lg"
                  className="w-full"
                  onClick={toggleReady}
                >
                  {isReady ? (
                    t('readyButton.cancelReady')
                  ) : (
                    <>
                      <CheckCircle2 size={20} /> {t('readyButton.ready')}
                    </>
                  )}
                </Button>

                {/* Enter workspace button */}
                {allReady && (
                  <motion.div
                    className="space-y-3 border-t border-border/60 pt-5"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                  >
                    {!isRoomValid && (
                      <p className="flex items-start gap-2 text-xs text-muted-foreground">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warning" />
                        {t('warning')}
                      </p>
                    )}
                    <Button size="lg" disabled={!isRoomValid} className="w-full">
                      <Play
                        size={18}
                        className={isRoomValid ? 'fill-current' : 'fill-current opacity-50'}
                      />
                      {t('readyButton.enterWorkspace')}
                    </Button>
                  </motion.div>
                )}
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

const JOIN_ERROR_KEYS: Partial<Record<string, string>> = {
  [ERROR_CODES.ROOM_NOT_FOUND]: 'lobby.roomNotFound',
  [ERROR_CODES.ROOM_FULL]: 'lobby.roomFull',
  [ERROR_CODES.ROOM_FINISHED]: 'lobby.roomFinished',
  [ERROR_CODES.ROOM_INVALID_CODE]: 'lobby.invalidCode',
  [ERROR_CODES.ROOM_ACCESS_DENIED]: 'lobby.accessDenied',
  [ERROR_CODES.ROOM_PERMISSION_DENIED]: 'lobby.accessDenied',
  [ERROR_CODES.ROOM_INVITE_CODE_EXHAUSTED]: 'lobby.invalidCode',
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
