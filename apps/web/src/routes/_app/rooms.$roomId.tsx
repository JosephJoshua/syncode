import { CONTROL_API, ERROR_CODES } from '@syncode/contracts';
import type { RoomRole, RoomStatus } from '@syncode/shared';
import { createFileRoute } from '@tanstack/react-router';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { RoomLobby } from '@/components/room-lobby.js';
import { RoomWorkspace } from '@/components/room-workspace.js';
import { api, readApiError } from '@/lib/api-client.js';
import { computeRoomElapsedMs, isWorkspaceStage, ROLE_LABEL_KEYS } from '@/lib/room-stage.js';
import { useAuthStore } from '@/stores/auth.store.js';

export const Route = createFileRoute('/_app/rooms/$roomId')({
  component: RoomPage,
});

type RoomDetail = Awaited<ReturnType<typeof api<typeof CONTROL_API.ROOMS.GET>>>;
type JoinResponse = Awaited<ReturnType<typeof api<typeof CONTROL_API.ROOMS.JOIN>>>;

const ROOM_REFRESH_INTERVAL_MS = 15_000;

function RoomPage() {
  const { t } = useTranslation('rooms');
  const { roomId } = Route.useParams();
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [isJoining, setIsJoining] = useState(true);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinNotice, setJoinNotice] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState<string | null>(null);
  const [isTransferringOwnership, setIsTransferringOwnership] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const joinPromiseRef = useRef<Promise<void> | null>(null);

  // Tick clock only when the timer is actively running (coding + not paused)
  const timerActive =
    room?.status === 'coding' && !room?.timerPaused && !!room?.currentPhaseStartedAt;
  useEffect(() => {
    if (!timerActive) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [timerActive]);

  const refreshRoomDetail = useCallback(async () => {
    const detail = await api(CONTROL_API.ROOMS.GET, { params: { id: roomId } });
    setRoom(detail);
    return detail;
  }, [roomId]);

  useEffect(() => {
    let cancelled = false;

    const loadRoom = async () => {
      setIsJoining(true);
      setJoinError(null);
      setJoinNotice(null);

      try {
        const url = new URL(window.location.href);
        const roomCode = url.searchParams.get('code')?.toUpperCase();

        if (roomCode) {
          // StrictMode guard: if a prior mount already started the JOIN,
          // await that promise instead of calling refreshRoomDetail() too early.
          if (joinPromiseRef.current) {
            await joinPromiseRef.current.catch(() => {});
            if (!cancelled) await refreshRoomDetail();
            return;
          }

          const joinPromise = (async () => {
            const joined = await api(CONTROL_API.ROOMS.JOIN, {
              params: { id: roomId },
              body: { roomCode },
            });

            if (cancelled) return;

            setRoom(joined.room);
            const notice = buildJoinNotice(joined, t);
            setJoinNotice(notice);
            toast.success(notice);
          })();

          joinPromiseRef.current = joinPromise;

          try {
            await joinPromise;
          } catch (error) {
            const apiError = await readApiError(error);

            if (apiError?.code === ERROR_CODES.ROOM_ALREADY_JOINED) {
              if (!cancelled) await refreshRoomDetail();
              return;
            }

            throw error;
          }
        } else if (!cancelled) {
          await refreshRoomDetail();
        }
      } catch (error) {
        if (!cancelled) {
          const apiError = await readApiError(error);
          const errorMsg = resolveJoinError(apiError, t);
          setJoinError(errorMsg);
        }
      } finally {
        if (!cancelled) setIsJoining(false);
      }
    };

    void loadRoom();

    return () => {
      cancelled = true;
    };
  }, [refreshRoomDetail, roomId, t]);

  const roomStatus = room?.status;
  useEffect(() => {
    if (!roomStatus || roomStatus === 'finished') return;

    const interval = window.setInterval(() => {
      if (document.hidden) return;
      void refreshRoomDetail().catch(() => undefined);
    }, ROOM_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [refreshRoomDetail, roomStatus]);

  const canChangePhase = room?.myCapabilities.includes('room:change-phase') ?? false;
  const canManageParticipants = room?.myCapabilities.includes('participant:assign-role') ?? false;
  const isWorkspace = room ? isWorkspaceStage(room.status) : false;
  const elapsedMs = useMemo(
    () =>
      computeRoomElapsedMs({
        status: room?.status ?? 'waiting',
        elapsedMs: room?.elapsedMs ?? 0,
        currentPhaseStartedAt: room?.currentPhaseStartedAt ?? null,
        timerPaused: room?.timerPaused ?? false,
        now,
      }),
    [now, room?.status, room?.elapsedMs, room?.currentPhaseStartedAt, room?.timerPaused],
  );

  const handleTransition = async (targetStatus: RoomStatus) => {
    setIsTransitioning(true);
    try {
      await api(CONTROL_API.ROOMS.TRANSITION_PHASE, {
        params: { id: roomId },
        body: { targetStatus },
      });
      await refreshRoomDetail();
    } catch (error) {
      const apiError = await readApiError(error);
      toast.error(apiError?.message ?? t('lobby.transitionFailed'));
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleParticipantRoleChange = async (participantUserId: string, role: RoomRole) => {
    setIsUpdatingRole(participantUserId);
    try {
      const response = await api(CONTROL_API.ROOMS.UPDATE_PARTICIPANT, {
        params: { id: roomId, participantUserId },
        body: { role },
      });
      setRoom(response.room);
      toast.success(t('workspace.roleUpdated'));
    } catch (error) {
      const apiError = await readApiError(error);
      toast.error(apiError?.message ?? t('lobby.roleUpdateFailed'));
    } finally {
      setIsUpdatingRole(null);
    }
  };

  const handleTransferOwnership = async (participantUserId: string, displayName: string) => {
    const confirmed = window.confirm(
      t('workspace.transferOwnershipConfirm', { name: displayName }),
    );
    if (!confirmed) return;

    setIsTransferringOwnership(participantUserId);
    try {
      await api(CONTROL_API.ROOMS.TRANSFER_OWNERSHIP, {
        params: { id: roomId },
        body: { targetUserId: participantUserId },
      });
      await refreshRoomDetail();
      toast.success(t('workspace.transferOwnershipSuccess', { name: displayName }));
    } catch (error) {
      const apiError = await readApiError(error);
      toast.error(apiError?.message ?? t('workspace.transferOwnershipFailed'));
    } finally {
      setIsTransferringOwnership(null);
    }
  };

  if (joinError && !room) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
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
      <div className="mx-auto max-w-5xl px-4 py-6">
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

  if (isWorkspace) {
    return (
      <RoomWorkspace
        room={room}
        currentUserId={currentUserId}
        roomId={roomId}
        elapsedMs={elapsedMs}
        isTransitioning={isTransitioning}
        onTransition={handleTransition}
        onParticipantRoleChange={handleParticipantRoleChange}
        onTransferOwnership={handleTransferOwnership}
        isUpdatingRole={isUpdatingRole}
        isTransferringOwnership={isTransferringOwnership}
      />
    );
  }

  return (
    <RoomLobby
      roomName={room.name}
      roomCode={room.roomCode}
      roomId={roomId}
      status={room.status}
      hostId={room.hostId}
      currentUserId={currentUserId}
      participants={room.participants}
      canChangePhase={canChangePhase}
      canManageParticipants={canManageParticipants}
      isTransitioning={isTransitioning}
      isUpdatingRole={isUpdatingRole}
      isTransferringOwnership={isTransferringOwnership}
      joinNotice={joinNotice}
      onParticipantRoleChange={handleParticipantRoleChange}
      onTransferOwnership={handleTransferOwnership}
      onTransition={handleTransition}
    />
  );
}

function buildJoinNotice(
  joined: JoinResponse,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
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
