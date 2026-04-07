import { CONTROL_API, ERROR_CODES } from '@syncode/contracts';
import type { RoomRole } from '@syncode/shared';
import {
  Badge,
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
  Terminal,
  UserCog,
  Users,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClipboard } from '@/hooks/use-clipboard.js';
import { api, readApiError } from '@/lib/api-client.js';
import { useAuthStore } from '@/stores/auth.store.js';

export const Route = createFileRoute('/_app/rooms/$roomId')({
  component: RoomLobbyPage,
});

type LobbyRole = RoomRole | 'unassigned';

type Participant = {
  id: string;
  username: string;
  isReady: boolean;
  isHost?: boolean;
  role: LobbyRole;
};

const ROLE_LABEL_KEYS: Record<string, string> = {
  host: 'role.host',
  candidate: 'role.candidate',
  interviewer: 'role.interviewer',
  spectator: 'role.observer',
  unassigned: 'role.unassigned',
};

const ROLE_OPTIONS: Array<{ value: LobbyRole; labelKey: string; descriptionKey: string }> = [
  { value: 'candidate', labelKey: 'roleSelect.candidate', descriptionKey: 'roleSelect.candidate' },
  {
    value: 'interviewer',
    labelKey: 'roleSelect.interviewer',
    descriptionKey: 'roleSelect.interviewer',
  },
  { value: 'spectator', labelKey: 'roleSelect.observer', descriptionKey: 'roleSelect.observer' },
];

function RoomLobbyPage() {
  const { t } = useTranslation('rooms');
  const { roomId } = Route.useParams();
  const currentUserId = useAuthStore((state) => state.user?.id);

  const [isJoining, setIsJoining] = useState(true);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [myRole, setMyRole] = useState<LobbyRole>('unassigned');
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
        resolvedRole: LobbyRole,
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

        setJoinError(apiError?.message ?? t('lobby.joinFailed'));
        setIsJoining(false);
      }
    };
    joinRoom();
  }, [roomId, currentUserId, t]);

  const handleRoleChange = (newRole: string) => {
    const role = newRole as LobbyRole;
    setMyRole(role);
    setParticipants((prev) => prev.map((p) => (p.id === currentUserId ? { ...p, role } : p)));
  };

  const toggleReady = () => {
    const newReadyState = !isReady;
    setIsReady(newReadyState);

    setParticipants((prev) =>
      prev.map((p) => (p.id === currentUserId ? { ...p, isReady: newReadyState } : p)),
    );
  };

  const copyInviteLink = () => copy(inviteLink);

  const { allReady, readyCount, totalCount, isRoomValid, asciiProgress } = useMemo(() => {
    const ready = participants.filter((p) => p.isReady).length;
    const total = participants.length;
    const every = ready === total && total > 0;

    const hasCandidate = participants.some((p) => p.role === 'candidate');
    const hasInterviewer = participants.some((p) => p.role === 'interviewer');

    const boxes = Array.from({ length: total })
      .map((_, i) => (i < ready ? '\u25a0' : '\u25a1'))
      .join(' ');

    return {
      allReady: every,
      readyCount: ready,
      totalCount: total,
      isRoomValid: hasCandidate && hasInterviewer,
      asciiProgress: `[ ${boxes} ]`,
    };
  }, [participants]);

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
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <section className="max-w-3xl">
          <div className="mb-2 inline-flex items-center justify-center rounded-full border border-border bg-card/50 p-3">
            <Terminal size={24} className="text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t('lobby.heading')}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">{t('lobby.sub')}</p>
        </section>

        <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <Badge variant="outline" className="gap-2 px-3 py-1.5 text-sm">
            <Users size={14} className="text-primary" />
            {readyCount} / {totalCount} {t('lobby.ready')}
          </Badge>

          <div className="flex w-full items-center gap-2 sm:max-w-md">
            <Input type="text" readOnly value={inviteLink} className="flex-1 font-mono text-sm" />
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={copyInviteLink}
              title={t('common:copyLink')}
            >
              {copied ? <Check size={16} className="text-primary" /> : <Copy size={16} />}
            </Button>
          </div>
        </div>

        {allReady && !isRoomValid && (
          <motion.div
            className="mt-6 max-w-2xl"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex items-center gap-3 rounded-lg border border-warning/50 bg-warning/10 p-4 text-warning">
              <AlertTriangle size={20} className="shrink-0" />
              <span className="text-sm font-semibold">{t('warning')}</span>
            </div>
          </motion.div>
        )}
      </motion.div>

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-12">
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
                  className={`p-5 transition-all duration-300 ${
                    participant.isReady
                      ? 'border-primary/40 bg-card shadow-[0_0_20px_hsl(var(--primary)/0.15)]'
                      : 'border-border/60 bg-card/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-lg font-bold text-foreground">
                        {participant.username.charAt(0).toUpperCase()}
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
                        <span
                          className={`mt-1 flex items-center gap-1.5 font-mono text-sm ${
                            participant.role === 'unassigned'
                              ? 'text-muted-foreground'
                              : 'text-primary'
                          }`}
                        >
                          <UserCog size={14} />
                          {t(ROLE_LABEL_KEYS[participant.role] ?? participant.role)}
                        </span>
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

        <div className="lg:col-span-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <Card className="sticky top-6 p-7">
              <div className="space-y-7">
                <div className="pb-4 pt-2 text-center font-mono">
                  <div
                    className={`mb-3 text-2xl transition-colors duration-500 ${allReady ? 'text-primary' : 'text-muted-foreground'}`}
                  >
                    {asciiProgress}
                  </div>
                  <div
                    className={`text-xs tracking-widest ${allReady ? 'text-primary' : 'animate-pulse text-primary/50'}`}
                  >
                    {allReady ? t('systemStatus.ready') : t('systemStatus.awaitingPeers')}
                  </div>
                </div>

                <div className="space-y-2.5">
                  <label
                    htmlFor="role-select"
                    className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
                  >
                    {t('roleSelect.heading')}
                  </label>
                  <Select value={myRole} onValueChange={handleRoleChange} disabled={isReady}>
                    <SelectTrigger id="role-select">
                      <div className="flex items-center gap-2">
                        <UserCog size={16} className="text-muted-foreground" />
                        <SelectValue placeholder={t('roleSelect.placeholder')} />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">{t('roleSelect.placeholder')}</SelectItem>
                      {myRole === 'host' && (
                        <SelectItem value="host">{t('roleSelect.host')}</SelectItem>
                      )}
                      {ROLE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {t(opt.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  variant={isReady ? 'outline' : 'default'}
                  size="lg"
                  className="w-full"
                  onClick={toggleReady}
                >
                  {isReady ? (
                    <>{t('readyButton.cancelReady')}</>
                  ) : (
                    <>
                      <CheckCircle2 size={20} /> {t('readyButton.ready')}
                    </>
                  )}
                </Button>

                {allReady && (
                  <motion.div
                    className="border-t border-border/60 pt-5"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                  >
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
