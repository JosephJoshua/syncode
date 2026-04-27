import { CONTROL_API, defineRoute, ERROR_CODES } from '@syncode/contracts';
import type { RoomRole, RoomStatus } from '@syncode/shared';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@syncode/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { MediaControls } from '@/components/media-controls.js';
import type {
  AudioProcessingSettings,
  VideoQualityPreset,
} from '@/components/media-settings-panel.js';
import { RoomLobby } from '@/components/room-lobby.js';
import { RoomWorkspace } from '@/components/room-workspace.js';
import {
  DockedVideoPanel,
  FloatingVideoPanel,
  type VideoPanelParticipant,
} from '@/components/video-panel.js';
import { useLiveKit } from '@/hooks/use-livekit.js';
import { useMediaShortcuts } from '@/hooks/use-media-shortcuts.js';
import { useYjsCollab } from '@/hooks/use-yjs-collab.js';
import { type ApiErrorResult, api, readApiError, resolveErrorMessage } from '@/lib/api-client.js';
import { computeRoomElapsedMs, isWorkspaceStage, ROLE_LABEL_KEYS } from '@/lib/room-stage.js';
import { useAuthStore } from '@/stores/auth.store.js';

export const Route = createFileRoute('/_app/rooms/$roomId')({
  component: RoomPage,
});

import type { JoinRoomResponse, RoomDetail } from '@syncode/contracts';

const ROOM_REFRESH_INTERVAL_MS = 15_000;
const REMOVE_PARTICIPANT_ROUTE = defineRoute<void, void>()(
  'rooms/:id/participants/:userId',
  'DELETE',
);

const CURSOR_COLORS = [
  '#00e599',
  '#60a5fa',
  '#f59e0b',
  '#818cf8',
  '#ec4899',
  '#22d3ee',
  '#f97316',
  '#a78bfa',
];

function userCursorColor(participants: { userId: string }[], currentUserId: string | null): string {
  if (!currentUserId) return CURSOR_COLORS[0]!;
  const index = participants.findIndex((p) => p.userId === currentUserId);
  return CURSOR_COLORS[index >= 0 ? index % CURSOR_COLORS.length : 0]!;
}

function RoomPage() {
  const { t } = useTranslation('rooms');
  const { roomId } = Route.useParams();
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [isJoining, setIsJoining] = useState(true);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinNotice, setJoinNotice] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState<string | null>(null);
  const [isTransferringOwnership, setIsTransferringOwnership] = useState<string | null>(null);
  const [pendingTransfer, setPendingTransfer] = useState<{
    userId: string;
    displayName: string;
  } | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<{
    userId: string;
    displayName: string;
  } | null>(null);
  const [now, setNow] = useState(Date.now());
  const joinPromiseRef = useRef<Promise<void> | null>(null);
  // Capture collab credentials once — subsequent polls generate fresh JWTs which would
  // cause the WebSocket to reconnect on every poll if used directly. The collab JWT has
  // a 24h lifetime, so the first token is valid for the entire session.
  const collabCredsRef = useRef<{ collabToken: string; collabUrl: string } | null>(null);

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
            collabCredsRef.current = {
              collabToken: joined.collabToken,
              collabUrl: joined.collabUrl,
            };
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
          try {
            await refreshRoomDetail();
          } catch (error) {
            const apiError = await readApiError(error);
            if (apiError?.code === ERROR_CODES.ROOM_ACCESS_DENIED) {
              const joined = await api(CONTROL_API.ROOMS.JOIN, {
                params: { id: roomId },
                body: {},
              });
              if (cancelled) return;
              setRoom(joined.room);
              collabCredsRef.current = {
                collabToken: joined.collabToken,
                collabUrl: joined.collabUrl,
              };
            } else {
              throw error;
            }
          }
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
      joinPromiseRef.current = null;
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

  const handleRoomStatePatch = useCallback(
    (patch: Partial<Pick<RoomDetail, 'status' | 'editorLocked'>>) => {
      setRoom((prev) => {
        if (!prev) return prev;
        if (patch.status === prev.status && patch.editorLocked === prev.editorLocked) return prev;
        return { ...prev, ...patch };
      });
    },
    [],
  );

  const handleParticipantReady = useCallback((userId: string, isReady: boolean) => {
    setRoom((prev) => {
      if (!prev) return prev;
      if (!prev.participants.some((p) => p.userId === userId && p.isReady !== isReady)) return prev;
      return {
        ...prev,
        participants: prev.participants.map((p) => (p.userId === userId ? { ...p, isReady } : p)),
      };
    });
  }, []);

  // Capture from room detail for the direct-navigation path (no ?code= join).
  // The join path sets the ref earlier from the join response.
  if (room?.collabToken && room?.collabUrl && !collabCredsRef.current) {
    collabCredsRef.current = { collabToken: room.collabToken, collabUrl: room.collabUrl };
  }

  const currentUser = useAuthStore((s) => s.user);
  const cursorColor = userCursorColor(room?.participants ?? [], currentUserId);

  const {
    status: collabStatus,
    doc,
    awareness,
  } = useYjsCollab({
    collabUrl: collabCredsRef.current?.collabUrl ?? null,
    collabToken: collabCredsRef.current?.collabToken ?? null,
    roomId,
    userName: currentUser?.displayName ?? currentUser?.username ?? 'Anonymous',
    userColor: cursorColor,
    onRoomStatePatch: handleRoomStatePatch,
    onParticipantReady: handleParticipantReady,
    onPhaseChange: () => void refreshRoomDetail(),
    onRoomNotFound: async () => {
      await api(CONTROL_API.ROOMS.ENSURE_COLLAB, { params: { id: roomId } });
    },
  });

  const mediaCredsRef = useRef<{ token: string; url: string } | null>(null);
  const [mediaReady, setMediaReady] = useState(false);
  const [videoPanelMode, setVideoPanelMode] = useState<'floating' | 'docked'>('docked');
  const [isVideoMinimized, setIsVideoMinimized] = useState(false);

  const hasMediaCapability =
    room?.myCapabilities.some(
      (c) => c === 'media:audio' || c === 'media:video' || c === 'media:screenshare',
    ) ?? false;

  const mediaTokenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!room || !hasMediaCapability) return;
    if (room.status === 'finished') return;
    if (mediaCredsRef.current) return;

    let disposed = false;

    const fetchToken = () => {
      api(CONTROL_API.ROOMS.MEDIA_TOKEN, { params: { id: roomId } })
        .then((result) => {
          if (disposed) return;
          mediaCredsRef.current = { token: result.token, url: result.url };
          setMediaReady(true);

          const expiresAt = new Date(result.expiresAt).getTime();
          const refreshIn = Math.max(expiresAt - Date.now() - 5 * 60 * 1000, 60_000);
          if (mediaTokenTimerRef.current) clearTimeout(mediaTokenTimerRef.current);
          mediaTokenTimerRef.current = setTimeout(() => {
            if (disposed) return;
            mediaCredsRef.current = null;
            setMediaReady(false);
            fetchToken();
          }, refreshIn);
        })
        .catch((err) => {
          if (disposed) return;
          console.warn('[LiveKit] Failed to fetch media token:', err);
        });
    };

    fetchToken();

    return () => {
      disposed = true;
      if (mediaTokenTimerRef.current) {
        clearTimeout(mediaTokenTimerRef.current);
        mediaTokenTimerRef.current = null;
      }
    };
  }, [room, hasMediaCapability, roomId]);

  const [audioProcessing, setAudioProcessing] = useState<AudioProcessingSettings>({
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: false,
  });
  const [videoQuality, setVideoQuality] = useState<VideoQualityPreset>('medium');

  const {
    connectionState: mediaConnectionState,
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
    switchDevice,
    audioInputDevices,
    videoInputDevices,
    activeAudioDeviceId,
    activeVideoDeviceId,
    setOutputVolume,
    setParticipantVolume,
    setParticipantMuted,
    setParticipantVideoHidden,
    participantVolumeMap,
    localMuteSet,
    videoHiddenSet,
    setVideoFilter,
    setAudioProcessing: applyAudioProcessing,
    connectionQualityMap,
    isPushToTalkMode,
    togglePushToTalkMode,
    handlePushToTalk,
    speakingMap,
    remoteParticipants: mediaRemoteParticipants,
    localParticipant: mediaLocalParticipant,
  } = useLiveKit({
    url: mediaCredsRef.current?.url ?? null,
    token: mediaCredsRef.current?.token ?? null,
    connect: mediaReady && hasMediaCapability && room?.status !== 'finished',
    audioProcessing,
  });

  const mediaConnectedSet = useMemo(() => {
    const set = new Set<string>();
    if (mediaLocalParticipant) set.add(mediaLocalParticipant.identity);
    for (const p of mediaRemoteParticipants) set.add(p.identity);
    return set;
  }, [mediaLocalParticipant, mediaRemoteParticipants]);

  const mediaMutedMap = useMemo(() => {
    const map = new Map<string, boolean>();
    if (mediaLocalParticipant)
      map.set(mediaLocalParticipant.identity, mediaLocalParticipant.isMuted);
    for (const p of mediaRemoteParticipants) map.set(p.identity, p.isMuted);
    return map;
  }, [mediaLocalParticipant, mediaRemoteParticipants]);

  const [outputVolume, setOutputVolumeState] = useState(1);

  const handleOutputVolumeChange = useCallback(
    (vol: number) => {
      setOutputVolumeState(vol);
      setOutputVolume(vol);
    },
    [setOutputVolume],
  );

  const mediaControlsElement = hasMediaCapability ? (
    <MediaControls
      connectionState={mediaConnectionState}
      isMicrophoneEnabled={isMicrophoneEnabled}
      isCameraEnabled={isCameraEnabled}
      isScreenShareEnabled={isScreenShareEnabled}
      canScreenShare={room?.myCapabilities.includes('media:screenshare') ?? false}
      onToggleMicrophone={() => void toggleMicrophone()}
      onToggleCamera={() => void toggleCamera()}
      onToggleScreenShare={() => void toggleScreenShare()}
      audioInputDevices={audioInputDevices}
      videoInputDevices={videoInputDevices}
      activeAudioDeviceId={activeAudioDeviceId}
      activeVideoDeviceId={activeVideoDeviceId}
      onSwitchDevice={(kind, id) => void switchDevice(kind, id)}
      outputVolume={outputVolume}
      onOutputVolumeChange={handleOutputVolumeChange}
      audioProcessing={audioProcessing}
      onAudioProcessingChange={(settings) => {
        setAudioProcessing(settings);
        void applyAudioProcessing(settings);
      }}
      onVideoFilterChange={(settings) => void setVideoFilter(settings)}
      videoQuality={videoQuality}
      onVideoQualityChange={setVideoQuality}
      isPushToTalkMode={isPushToTalkMode}
      onTogglePushToTalkMode={togglePushToTalkMode}
    />
  ) : null;

  useMediaShortcuts({
    toggleMicrophone: () => void toggleMicrophone(),
    toggleCamera: () => void toggleCamera(),
    toggleScreenShare: () => void toggleScreenShare(),
    togglePushToTalk: isPushToTalkMode ? handlePushToTalk : undefined,
    enabled: hasMediaCapability && mediaConnectionState === 'connected',
  });

  const videoTiles = useMemo(() => {
    const tiles: VideoPanelParticipant[] = [];

    if (mediaLocalParticipant && currentUserId) {
      const me = room?.participants.find((p) => p.userId === currentUserId);
      tiles.push({
        identity: currentUserId,
        displayName: me?.displayName ?? me?.username ?? 'You',
        avatarUrl: me?.avatarUrl ?? null,
        hasVideo: mediaLocalParticipant.hasVideo,
        videoTrack: mediaLocalParticipant.videoTrack,
        hasScreenShare: mediaLocalParticipant.hasScreenShare,
        screenShareTrack: mediaLocalParticipant.screenShareTrack,
        isSpeaking: speakingMap.get(currentUserId) ?? false,
        isLocal: true,
      });
    }

    for (const mp of mediaRemoteParticipants) {
      const p = room?.participants.find((rp) => rp.userId === mp.identity);
      const hidden = videoHiddenSet.has(mp.identity);
      tiles.push({
        identity: mp.identity,
        displayName: p?.displayName ?? p?.username ?? mp.identity,
        avatarUrl: p?.avatarUrl ?? null,
        hasVideo: hidden ? false : mp.hasVideo,
        videoTrack: hidden ? null : mp.videoTrack,
        hasScreenShare: mp.hasScreenShare,
        screenShareTrack: mp.screenShareTrack,
        isSpeaking: speakingMap.get(mp.identity) ?? false,
        isLocal: false,
      });
    }

    return tiles;
  }, [
    mediaLocalParticipant,
    mediaRemoteParticipants,
    speakingMap,
    currentUserId,
    room?.participants,
    videoHiddenSet,
  ]);

  const showMediaPanel =
    mediaConnectionState === 'connected' || mediaConnectionState === 'reconnecting';

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
      toast.error(
        resolveErrorMessage(apiError, TRANSITION_ERROR_KEYS, 'lobby.transitionFailed', t),
      );
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
      toast.error(
        resolveErrorMessage(apiError, ROLE_UPDATE_ERROR_KEYS, 'lobby.roleUpdateFailed', t),
      );
    } finally {
      setIsUpdatingRole(null);
    }
  };

  const handleTransferOwnership = (participantUserId: string, displayName: string) => {
    setPendingTransfer({ userId: participantUserId, displayName });
  };

  const handleRemoveParticipant = (participantUserId: string, displayName: string) => {
    setPendingRemoval({ userId: participantUserId, displayName });
  };

  const confirmTransferOwnership = async () => {
    if (!pendingTransfer) return;
    const { userId, displayName } = pendingTransfer;
    setPendingTransfer(null);

    setIsTransferringOwnership(userId);
    try {
      await api(CONTROL_API.ROOMS.TRANSFER_OWNERSHIP, {
        params: { id: roomId },
        body: { targetUserId: userId },
      });
      await refreshRoomDetail();
      toast.success(t('workspace.transferOwnershipSuccess', { name: displayName }));
    } catch (error) {
      const apiError = await readApiError(error);
      toast.error(
        resolveErrorMessage(apiError, TRANSFER_ERROR_KEYS, 'workspace.transferOwnershipFailed', t),
      );
    } finally {
      setIsTransferringOwnership(null);
    }
  };

  const removeParticipantMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string; displayName: string }) =>
      api(REMOVE_PARTICIPANT_ROUTE, {
        params: { id: roomId, userId },
      }),
    onSuccess: async (_, variables) => {
      setPendingRemoval(null);
      await refreshRoomDetail();
      void queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast.success(t('workspace.removeParticipantSuccess', { name: variables.displayName }));
    },
    onError: async (error) => {
      const apiError = await readApiError(error);
      toast.error(apiError?.message ?? t('workspace.removeParticipantFailed'));
    },
  });

  const handleToggleReady = useCallback(async () => {
    try {
      const updated = await api(CONTROL_API.ROOMS.TOGGLE_READY, { params: { id: roomId } });
      setRoom(updated);
    } catch (error) {
      const apiError = await readApiError(error);
      toast.error(apiError?.message ?? t('lobby.readyFailed'));
    }
  }, [roomId, t]);

  const confirmRemoveParticipant = () => {
    if (!pendingRemoval || removeParticipantMutation.isPending) return;
    removeParticipantMutation.mutate(pendingRemoval);
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

  const transferDialog = (
    <AlertDialog
      open={!!pendingTransfer}
      onOpenChange={(open) => {
        if (!open) setPendingTransfer(null);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('workspace.transferOwnershipTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('workspace.transferOwnershipConfirm', { name: pendingTransfer?.displayName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('workspace.cancel')}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => void confirmTransferOwnership()}>
            {t('workspace.transferOwnershipAction')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const removeParticipantDialog = (
    <AlertDialog
      open={!!pendingRemoval}
      onOpenChange={(open) => {
        if (!open && !removeParticipantMutation.isPending) {
          setPendingRemoval(null);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('workspace.removeParticipantTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('workspace.removeParticipantConfirm', { name: pendingRemoval?.displayName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={removeParticipantMutation.isPending}>
            {t('workspace.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={removeParticipantMutation.isPending}
            onClick={() => confirmRemoveParticipant()}
          >
            {removeParticipantMutation.isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                {t('workspace.removeParticipantAction')}
              </span>
            ) : (
              t('workspace.removeParticipantAction')
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (isWorkspace) {
    return (
      <>
        {transferDialog}
        {removeParticipantDialog}
        <RoomWorkspace
          room={room}
          currentUserId={currentUserId}
          roomId={roomId}
          elapsedMs={elapsedMs}
          isTransitioning={isTransitioning}
          onTransition={handleTransition}
          onParticipantRoleChange={handleParticipantRoleChange}
          onTransferOwnership={handleTransferOwnership}
          onRemoveParticipant={handleRemoveParticipant}
          isUpdatingRole={isUpdatingRole}
          isTransferringOwnership={isTransferringOwnership}
          isRemovingParticipant={
            removeParticipantMutation.isPending
              ? (removeParticipantMutation.variables?.userId ?? null)
              : null
          }
          collabStatus={collabStatus}
          doc={doc}
          awareness={awareness}
          currentUserName={currentUser?.displayName ?? currentUser?.username ?? 'Anonymous'}
          speakingMap={speakingMap}
          mediaControls={mediaControlsElement}
          mediaConnectedSet={mediaConnectedSet}
          mediaMutedMap={mediaMutedMap}
          connectionQualityMap={connectionQualityMap}
          participantMediaControls={{
            setVolume: setParticipantVolume,
            setMuted: setParticipantMuted,
            setVideoHidden: setParticipantVideoHidden,
            volumeMap: participantVolumeMap,
            muteSet: localMuteSet,
            videoHiddenSet,
          }}
          dockedVideoPanel={
            showMediaPanel && videoPanelMode === 'docked' ? (
              <DockedVideoPanel tiles={videoTiles} onUndock={() => setVideoPanelMode('floating')} />
            ) : null
          }
        />
        {showMediaPanel && videoPanelMode === 'floating' ? (
          <FloatingVideoPanel
            tiles={videoTiles}
            isMinimized={isVideoMinimized}
            onToggleMinimize={() => setIsVideoMinimized((v) => !v)}
            onDock={() => setVideoPanelMode('docked')}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      {transferDialog}
      {removeParticipantDialog}
      <RoomLobby
        roomName={room.name}
        roomCode={room.roomCode}
        roomId={roomId}
        mode={room.mode}
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
        onToggleReady={handleToggleReady}
        onTransition={handleTransition}
        speakingMap={speakingMap}
        mediaConnectedSet={mediaConnectedSet}
        mediaMutedMap={mediaMutedMap}
        participantMediaControls={{
          setVolume: setParticipantVolume,
          setMuted: setParticipantMuted,
          setVideoHidden: setParticipantVideoHidden,
          volumeMap: participantVolumeMap,
          muteSet: localMuteSet,
          videoHiddenSet,
        }}
      />
    </>
  );
}

function buildJoinNotice(
  joined: JoinRoomResponse,
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

const TRANSITION_ERROR_KEYS: Partial<Record<string, string>> = {
  [ERROR_CODES.ROOM_INVALID_TRANSITION]: 'lobby.invalidTransition',
  [ERROR_CODES.ROOM_NOT_PEER_MODE]: 'lobby.notPeerMode',
  [ERROR_CODES.ROOM_PERMISSION_DENIED]: 'lobby.accessDenied',
  [ERROR_CODES.ROOM_PARTICIPANTS_NOT_READY]: 'lobby.participantsNotReady',
};

const ROLE_UPDATE_ERROR_KEYS: Partial<Record<string, string>> = {
  [ERROR_CODES.ROOM_ROLE_CONSTRAINT_VIOLATION]: 'lobby.roleConstraintViolation',
  [ERROR_CODES.PARTICIPANT_NOT_FOUND]: 'lobby.participantNotFound',
  [ERROR_CODES.ROOM_PERMISSION_DENIED]: 'lobby.accessDenied',
  [ERROR_CODES.ROOM_NOT_PEER_MODE]: 'lobby.notPeerMode',
};

const TRANSFER_ERROR_KEYS: Partial<Record<string, string>> = {
  [ERROR_CODES.PARTICIPANT_CANNOT_TRANSFER_OWNERSHIP]: 'workspace.cannotTransferOwnership',
  [ERROR_CODES.PARTICIPANT_NOT_FOUND]: 'lobby.participantNotFound',
  [ERROR_CODES.ROOM_PERMISSION_DENIED]: 'lobby.accessDenied',
};

function resolveJoinError(apiError: ApiErrorResult, t: (key: string) => string): string {
  return resolveErrorMessage(apiError, JOIN_ERROR_KEYS, 'lobby.joinFailed', t);
}
