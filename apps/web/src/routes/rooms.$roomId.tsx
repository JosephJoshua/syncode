import { CONTROL_API, ERROR_CODES } from '@syncode/contracts';
import type { RoomRole } from '@syncode/shared';
import { Badge, Button, Card, Input } from '@syncode/ui';
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
import type { ChangeEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClipboard } from '@/hooks/use-clipboard';
import { api, readApiError } from '@/lib/api-client';
import { requireAuth } from '@/lib/auth';
import { useAuthStore } from '@/stores/auth.store';

export const Route = createFileRoute('/rooms/$roomId')({
  beforeLoad: requireAuth,
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

const ROLE_LABEL_KEYS: Record<LobbyRole, string> = {
  host: 'role.host',
  candidate: 'role.candidate',
  interviewer: 'role.interviewer',
  spectator: 'role.observer',
  unassigned: 'role.unassigned',
};

function RoomLobbyPage() {
  const { t } = useTranslation('rooms');
  const { roomId } = Route.useParams();
  const currentUserId = useAuthStore((state) => state.user?.id);

  const [isJoining, setIsJoining] = useState(true);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [myRole, setMyRole] = useState<LobbyRole>('unassigned');
  const [participants, setParticipants] = useState<Participant[]>([]);
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
              username: isMe ? `${baseName} (You)` : baseName,
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

        setJoinError(null);
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

  const handleRoleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value as LobbyRole;
    setMyRole(newRole);
    setParticipants((prev) =>
      prev.map((p) => (p.id === currentUserId ? { ...p, role: newRole } : p)),
    );
  };

  const toggleReady = () => {
    const newReadyState = !isReady;
    setIsReady(newReadyState);

    setParticipants((prev) =>
      prev.map((p) => (p.id === currentUserId ? { ...p, isReady: newReadyState } : p)),
    );
  };

  const copyInviteLink = () => copy(window.location.href);

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
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-foreground">
        <AlertTriangle size={42} className="mb-4 text-warning" />
        <h2 className="text-xl font-bold tracking-wide text-foreground">
          {t('lobby.unableToJoin')}
        </h2>
        <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">{joinError}</p>
      </div>
    );
  }

  if (isJoining) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
        <Loader2 size={48} className="mb-6 animate-spin text-primary" />
        <h2 className="text-xl font-bold uppercase tracking-widest text-muted-foreground">
          {t('lobby.connecting')}
        </h2>
        <p className="mt-2 font-mono text-sm text-muted-foreground">
          {t('lobby.authenticating', { roomId: roomId.slice(0, 8) })}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-start bg-background px-4 py-12 text-foreground">
      <div className="animate-in fade-in slide-in-from-bottom-8 w-full max-w-5xl duration-700">
        <div className="mb-14 space-y-6 text-center">
          <div className="inline-flex items-center justify-center rounded-full border border-border bg-card/50 p-4">
            <Terminal size={32} className="text-primary" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tighter text-foreground">
            {t('lobby.heading')}
          </h1>

          <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center gap-4 sm:flex-row">
            <Badge variant="outline" className="gap-2 px-4 py-1.5 text-sm">
              <Users size={16} className="text-primary" />
              {readyCount} / {totalCount} {t('lobby.ready')}
            </Badge>

            <div className="flex w-full items-center rounded-xl border border-border bg-background p-1.5 transition-all duration-300 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 sm:w-[420px]">
              <Input
                type="text"
                readOnly
                value={window.location.href}
                className="flex-1 border-none bg-transparent font-mono shadow-none focus-visible:ring-0"
              />
              <button
                type="button"
                onClick={copyInviteLink}
                className="flex shrink-0 items-center justify-center rounded-lg bg-muted p-2.5 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
                title="Copy link"
              >
                {copied ? <Check size={16} className="text-primary" /> : <Copy size={16} />}
              </button>
            </div>
          </div>

          {allReady && !isRoomValid && (
            <div className="animate-in fade-in slide-in-from-top-2 mx-auto mt-6 w-full max-w-2xl duration-500">
              <div className="flex items-center justify-center gap-3 rounded-xl border border-warning/50 bg-warning/10 p-4 text-warning">
                <AlertTriangle size={20} className="shrink-0" />
                <span className="text-sm font-semibold">{t('warning')}</span>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {participants.map((participant) => (
                <Card
                  key={participant.id}
                  className={`rounded-2xl p-5 transition-all duration-300 ${
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
                          {t(ROLE_LABEL_KEYS[participant.role])}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end justify-center">
                      {participant.isReady ? (
                        <CheckCircle2 size={24} className="text-primary" />
                      ) : (
                        <Circle size={24} className="text-muted-foreground/40" />
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <div className="mt-8 lg:col-span-4 lg:mt-0">
            <Card className="sticky top-6 rounded-2xl p-7">
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
                  <div className="relative">
                    <select
                      id="role-select"
                      value={myRole}
                      onChange={handleRoleChange}
                      disabled={isReady}
                      className="w-full appearance-none rounded-lg border border-border bg-background p-3 text-sm text-foreground outline-none transition-all duration-300 focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="unassigned">{t('roleSelect.placeholder')}</option>
                      {myRole === 'host' && <option value="host">{t('roleSelect.host')}</option>}
                      <option value="candidate">{t('roleSelect.candidate')}</option>
                      <option value="interviewer">{t('roleSelect.interviewer')}</option>
                      <option value="spectator">{t('roleSelect.observer')}</option>
                    </select>
                    <UserCog
                      className="pointer-events-none absolute right-3.5 top-3 text-muted-foreground"
                      size={18}
                    />
                  </div>
                </div>

                <Button
                  variant={isReady ? 'outline' : 'default'}
                  size="lg"
                  className="w-full rounded-xl"
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

                {allReady && (
                  <div className="animate-in fade-in zoom-in border-t border-border/60 pt-5 duration-500">
                    <Button size="lg" disabled={!isRoomValid} className="w-full rounded-xl">
                      <Play
                        size={18}
                        className={isRoomValid ? 'fill-current' : 'fill-current opacity-50'}
                      />
                      {t('readyButton.enterWorkspace')}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
