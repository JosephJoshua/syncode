import { CONTROL_API, ERROR_CODES } from '@syncode/contracts';
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
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import ky from 'ky';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { MediaControls } from '@/components/media-controls.js';
import { RoomLobby } from '@/components/room-lobby.js';
import { RoomWorkspace } from '@/components/room-workspace.js';
import { STAGE_TRANSITION_OVERLAY_DURATION_MS } from '@/components/stage-transition-overlay.js';
import {
  DockedVideoPanel,
  FloatingVideoPanel,
  type VideoPanelParticipant,
} from '@/components/video-panel.js';
import { type LiveKitDataPacket, useLiveKit } from '@/hooks/use-livekit.js';
import { useMediaShortcuts } from '@/hooks/use-media-shortcuts.js';
import { useYjsCollab } from '@/hooks/use-yjs-collab.js';
import { api, readApiError, resolveErrorMessage } from '@/lib/api-client.js';
import { resolveJoinError } from '@/lib/join-errors.js';
import { computeRoomElapsedMs, isWorkspaceStage, ROLE_LABEL_KEYS } from '@/lib/room-stage.js';
import { useAuthStore } from '@/stores/auth.store.js';
import { useMediaSettingsStore } from '@/stores/media-settings.store.js';

export const Route = createFileRoute('/_app/rooms_/$roomId')({
  component: RoomPage,
});

import type {
  ChatAttachment,
  ChatReactToggleEventData,
  ChatSendEventData,
  JoinRoomResponse,
  RoomDetail,
} from '@syncode/contracts';

const ROOM_REFRESH_INTERVAL_MS = 15_000;

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

const AI_INTERVIEWER_IDENTITY =
  (import.meta.env.VITE_AI_INTERVIEWER_IDENTITY as string | undefined)?.trim() || 'ai-interviewer';
const AI_INTERVIEWER_REALTIME_ENABLED =
  ((import.meta.env.VITE_AI_INTERVIEWER_LIVEKIT_ENABLED as string | undefined)
    ?.trim()
    .toLowerCase() ?? 'true') === 'true';

function userCursorColor(participants: { userId: string }[], currentUserId: string | null): string {
  const defaultColor = CURSOR_COLORS[0] ?? '#00e599';

  if (!currentUserId) return defaultColor;
  const index = participants.findIndex((p) => p.userId === currentUserId);
  return CURSOR_COLORS[index >= 0 ? index % CURSOR_COLORS.length : 0] ?? defaultColor;
}

function toChatAttachmentKind(contentType: string): ChatAttachment['kind'] {
  if (contentType.startsWith('image/')) {
    return 'image';
  }
  if (contentType.startsWith('video/')) {
    return 'video';
  }
  if (contentType.startsWith('audio/')) {
    return 'audio';
  }
  return 'file';
}

interface JoinDeps {
  roomId: string;
  refreshRoomDetail: () => Promise<RoomDetail>;
  setRoom: (detail: RoomDetail) => void;
  setJoinNotice: (msg: string) => void;
  collabCredsRef: React.RefObject<{ collabToken: string; collabUrl: string } | null>;
  joinPromiseRef: React.RefObject<Promise<void> | null>;
  t: (key: string, opts?: Record<string, unknown>) => string;
  isCancelled: () => boolean;
}

async function performJoinWithCode(roomCode: string, deps: JoinDeps): Promise<void> {
  if (deps.joinPromiseRef.current) {
    await deps.joinPromiseRef.current.catch(() => {});
    if (!deps.isCancelled()) await deps.refreshRoomDetail();
    return;
  }

  const joinPromise = (async () => {
    const joined = await api(CONTROL_API.ROOMS.JOIN, {
      params: { id: deps.roomId },
      body: { roomCode },
    });
    if (deps.isCancelled()) return;
    deps.setRoom(joined.room);
    deps.collabCredsRef.current = {
      collabToken: joined.collabToken,
      collabUrl: joined.collabUrl,
    };
    const notice = buildJoinNotice(joined, deps.t);
    deps.setJoinNotice(notice);
    toast.success(notice);
  })();

  deps.joinPromiseRef.current = joinPromise;

  try {
    await joinPromise;
  } catch (error) {
    const apiError = await readApiError(error);
    if (apiError?.code === ERROR_CODES.ROOM_ALREADY_JOINED) {
      if (!deps.isCancelled()) await deps.refreshRoomDetail();
      return;
    }
    throw error;
  }
}

async function performLoadOrRecover(deps: JoinDeps): Promise<void> {
  try {
    await deps.refreshRoomDetail();
  } catch (error) {
    const apiError = await readApiError(error);
    if (apiError?.code !== ERROR_CODES.ROOM_ACCESS_DENIED) throw error;
    const joined = await api(CONTROL_API.ROOMS.JOIN, {
      params: { id: deps.roomId },
      body: {},
    });
    if (deps.isCancelled()) return;
    deps.setRoom(joined.room);
    deps.collabCredsRef.current = {
      collabToken: joined.collabToken,
      collabUrl: joined.collabUrl,
    };
  }
}

function RoomPage() {
  const { t } = useTranslation('rooms');
  const { roomId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const authUser = useAuthStore((state) => state.user);
  const currentUserId = authUser?.id ?? null;
  const [stableCurrentUserId, setStableCurrentUserId] = useState<string | null>(currentUserId);
  const [stableCurrentUserName, setStableCurrentUserName] = useState<string>(
    authUser?.displayName ?? authUser?.username ?? 'Anonymous',
  );
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [isJoining, setIsJoining] = useState(true);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinNotice, setJoinNotice] = useState<string | null>(null);
  const [mockWorkspacePreview, setMockWorkspacePreview] = useState(false);
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
  const [latestLiveKitDataPacket, setLatestLiveKitDataPacket] = useState<LiveKitDataPacket | null>(
    null,
  );
  const [now, setNow] = useState(Date.now());
  const joinPromiseRef = useRef<Promise<void> | null>(null);
  const previousStatusRef = useRef<RoomStatus | null>(null);
  const shouldRedirectToSessionRef = useRef(false);
  // Capture collab credentials once — subsequent polls generate fresh JWTs which would
  // cause the WebSocket to reconnect on every poll if used directly. The collab JWT has
  // a 24h lifetime, so the first token is valid for the entire session.
  const collabCredsRef = useRef<{ collabToken: string; collabUrl: string } | null>(null);
  // Flips to true when the server reports ROOM_PARTICIPANT_REMOVED during the
  // post-reconnect /join re-call. Short-circuits further reconnect attempts and
  // redirects away from the now-inaccessible room.
  const kickedRef = useRef(false);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    setStableCurrentUserId(currentUserId);
  }, [currentUserId]);

  useEffect(() => {
    const nextUserName = authUser?.displayName ?? authUser?.username;
    if (!nextUserName) {
      return;
    }

    setStableCurrentUserName(nextUserName);
  }, [authUser?.displayName, authUser?.username]);

  // Tick clock only when the timer is actively running (coding + not paused)
  const timerActive =
    room?.status === 'coding' && !room?.timerPaused && !!room?.currentPhaseStartedAt;
  useEffect(() => {
    if (!timerActive) return;
    const interval = globalThis.window.setInterval(() => setNow(Date.now()), 1000);
    return () => globalThis.window.clearInterval(interval);
  }, [timerActive]);

  const refreshRoomDetail = useCallback(async () => {
    const detail = await api(CONTROL_API.ROOMS.GET, { params: { id: roomId } });
    setRoom(detail);
    return detail;
  }, [roomId]);

  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;

    const loadRoom = async () => {
      setIsJoining(true);
      setJoinError(null);
      setJoinNotice(null);

      const deps: JoinDeps = {
        roomId,
        refreshRoomDetail,
        setRoom,
        setJoinNotice,
        collabCredsRef,
        joinPromiseRef,
        t,
        isCancelled,
      };

      try {
        const roomCode = new URL(globalThis.window.location.href).searchParams
          .get('code')
          ?.toUpperCase();
        if (roomCode) {
          await performJoinWithCode(roomCode, deps);
        } else if (!cancelled) {
          await performLoadOrRecover(deps);
        }
      } catch (error) {
        if (!cancelled) {
          const apiError = await readApiError(error);
          setJoinError(resolveJoinError(apiError, t));
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

  useEffect(() => {
    const currentStatus = room?.status ?? null;
    const previousStatus = previousStatusRef.current;

    if (currentStatus === 'finished' && previousStatus && previousStatus !== 'finished') {
      shouldRedirectToSessionRef.current = true;
    }

    previousStatusRef.current = currentStatus;
  }, [room?.status]);

  useEffect(() => {
    if (!shouldRedirectToSessionRef.current || room?.status !== 'finished' || !room.sessionId) {
      return;
    }

    const finishedSessionId = room.sessionId;
    const redirectTimer = window.setTimeout(() => {
      shouldRedirectToSessionRef.current = false;
      navigate({
        to: '/sessions/$sessionId',
        params: { sessionId: finishedSessionId },
      }).catch(() => {});
    }, STAGE_TRANSITION_OVERLAY_DURATION_MS + 2000);

    return () => window.clearTimeout(redirectTimer);
  }, [navigate, room?.sessionId, room?.status]);

  const roomStatus = room?.status;
  useEffect(() => {
    if (!roomStatus || roomStatus === 'finished') return;

    const interval = globalThis.window.setInterval(() => {
      if (document.hidden) return;
      void refreshRoomDetail().catch(() => undefined);
    }, ROOM_REFRESH_INTERVAL_MS);

    return () => globalThis.window.clearInterval(interval);
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

  const presenceRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleAwarenessPeersChanged = useCallback(() => {
    if (presenceRefreshTimerRef.current) {
      clearTimeout(presenceRefreshTimerRef.current);
    }

    presenceRefreshTimerRef.current = setTimeout(() => {
      presenceRefreshTimerRef.current = null;
      void refreshRoomDetail().catch(() => undefined);
    }, 250);
  }, [refreshRoomDetail]);

  useEffect(
    () => () => {
      if (presenceRefreshTimerRef.current) {
        clearTimeout(presenceRefreshTimerRef.current);
      }
    },
    [],
  );

  // Capture from room detail for the direct-navigation path (no ?code= join).
  // The join path sets the ref earlier from the join response.
  if (room?.collabToken && room?.collabUrl && !collabCredsRef.current) {
    collabCredsRef.current = { collabToken: room.collabToken, collabUrl: room.collabUrl };
  }

  const cursorColor = userCursorColor(room?.participants ?? [], stableCurrentUserId);

  const {
    status: collabStatus,
    doc,
    awareness,
    chatMessages,
    chatReadAtByUserId,
    sendChatMessage,
    toggleChatReaction,
    markChatRead,
  } = useYjsCollab({
    collabUrl: collabCredsRef.current?.collabUrl ?? null,
    collabToken: collabCredsRef.current?.collabToken ?? null,
    roomId,
    userName: stableCurrentUserName,
    userColor: cursorColor,
    onRoomStatePatch: handleRoomStatePatch,
    onParticipantReady: handleParticipantReady,
    onPhaseChange: () => void refreshRoomDetail(),
    onLanguageChange: () => void refreshRoomDetail(),
    onAwarenessPeersChanged: handleAwarenessPeersChanged,
    onReconnected: () => {
      if (kickedRef.current) return;
      void (async () => {
        try {
          const result = await api(CONTROL_API.ROOMS.JOIN, {
            params: { id: roomId },
            body: {},
          });
          setRoom(result.room);
        } catch (error) {
          const apiError = await readApiError(error);
          if (apiError?.code === ERROR_CODES.ROOM_PARTICIPANT_REMOVED) {
            kickedRef.current = true;
            toast.error(apiError.message ?? t('lobby.removedFromRoom'));
            navigate({ to: '/rooms' }).catch(() => undefined);
            return;
          }
          // Other errors are non-fatal — the participant sweep will reconcile.
        }
      })();
    },
    onRoomNotFound: async () => {
      await api(CONTROL_API.ROOMS.ENSURE_COLLAB, { params: { id: roomId } });
    },
  });

  useEffect(() => {
    if (!stableCurrentUserId || !room) {
      return;
    }

    const me = room.participants.find((participant) => participant.userId === stableCurrentUserId);
    const fallbackName = me?.displayName ?? me?.username;
    if (!fallbackName) {
      return;
    }

    setStableCurrentUserName(fallbackName);
  }, [room, stableCurrentUserId]);

  const mediaCredsRef = useRef<{ token: string; url: string } | null>(null);
  const [mediaReady, setMediaReady] = useState(false);
  const videoPanelMode = useMediaSettingsStore((s) => s.videoPanelMode);
  const setVideoPanelMode = useMediaSettingsStore((s) => s.setVideoPanelMode);
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

    const scheduleTokenRefresh = (refreshIn: number) => {
      if (mediaTokenTimerRef.current) clearTimeout(mediaTokenTimerRef.current);
      mediaTokenTimerRef.current = setTimeout(() => {
        if (disposed) return;
        mediaCredsRef.current = null;
        setMediaReady(false);
        fetchToken();
      }, refreshIn);
    };

    const fetchToken = () => {
      api(CONTROL_API.ROOMS.MEDIA_TOKEN, { params: { id: roomId } })
        .then((result) => {
          if (disposed) return;
          mediaCredsRef.current = { token: result.token, url: result.url };
          setMediaReady(true);

          const expiresAt = new Date(result.expiresAt).getTime();
          const refreshIn = Math.max(expiresAt - Date.now() - 5 * 60 * 1000, 60_000);
          scheduleTokenRefresh(refreshIn);
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

  const audioProcessing = useMediaSettingsStore((s) => s.audioProcessing);
  const setAudioProcessingStored = useMediaSettingsStore((s) => s.setAudioProcessing);
  const videoQuality = useMediaSettingsStore((s) => s.videoQuality);
  const setVideoQuality = useMediaSettingsStore((s) => s.setVideoQuality);
  const preferredAudioDeviceId = useMediaSettingsStore((s) => s.audioInputDeviceId);
  const preferredVideoDeviceId = useMediaSettingsStore((s) => s.videoInputDeviceId);
  const setAudioInputDeviceId = useMediaSettingsStore((s) => s.setAudioInputDeviceId);
  const setVideoInputDeviceId = useMediaSettingsStore((s) => s.setVideoInputDeviceId);
  const reconcileDevices = useMediaSettingsStore((s) => s.reconcileDevices);
  const outputVolume = useMediaSettingsStore((s) => s.outputVolume);
  const setOutputVolumeStored = useMediaSettingsStore((s) => s.setOutputVolume);

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
    publishData,
  } = useLiveKit({
    url: mediaCredsRef.current?.url ?? null,
    token: mediaCredsRef.current?.token ?? null,
    connect: mediaReady && hasMediaCapability && room?.status !== 'finished',
    audioProcessing,
    preferredAudioDeviceId,
    preferredVideoDeviceId,
    onDevicesDiscovered: reconcileDevices,
    onDataReceived: setLatestLiveKitDataPacket,
  });

  useEffect(() => {
    setLatestLiveKitDataPacket(null);
  }, []);

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

  const handleOutputVolumeChange = useCallback(
    (vol: number) => {
      setOutputVolumeStored(vol);
      setOutputVolume(vol);
    },
    [setOutputVolume, setOutputVolumeStored],
  );

  // Replay the persisted volume onto any attached audio elements whenever it
  // changes (including right after connect, once elements exist).
  useEffect(() => {
    setOutputVolume(outputVolume);
  }, [outputVolume, setOutputVolume]);

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
      onSwitchDevice={(kind, id) => {
        if (kind === 'audioinput') setAudioInputDeviceId(id);
        else if (kind === 'videoinput') setVideoInputDeviceId(id);
        void switchDevice(kind, id);
      }}
      outputVolume={outputVolume}
      onOutputVolumeChange={handleOutputVolumeChange}
      audioProcessing={audioProcessing}
      onAudioProcessingChange={(settings) => {
        setAudioProcessingStored(settings);
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

    if (mediaLocalParticipant && stableCurrentUserId) {
      const me = room?.participants.find((p) => p.userId === stableCurrentUserId);
      tiles.push({
        identity: stableCurrentUserId,
        displayName: me?.displayName ?? me?.username ?? 'You',
        avatarUrl: me?.avatarUrl ?? null,
        isAiInterviewer: false,
        hasVideo: mediaLocalParticipant.hasVideo,
        videoTrack: mediaLocalParticipant.videoTrack,
        hasScreenShare: mediaLocalParticipant.hasScreenShare,
        screenShareTrack: mediaLocalParticipant.screenShareTrack,
        isSpeaking: speakingMap.get(stableCurrentUserId) ?? false,
        isLocal: true,
      });
    }

    for (const mp of mediaRemoteParticipants) {
      const isAiInterviewer = mp.identity === AI_INTERVIEWER_IDENTITY;
      const p = room?.participants.find((rp) => rp.userId === mp.identity);
      const hidden = videoHiddenSet.has(mp.identity);
      tiles.push({
        identity: mp.identity,
        displayName: isAiInterviewer
          ? t('workspace.aiInterviewAi')
          : (p?.displayName ?? p?.username ?? mp.identity),
        avatarUrl: p?.avatarUrl ?? null,
        isAiInterviewer,
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
    stableCurrentUserId,
    room?.participants,
    t,
    videoHiddenSet,
  ]);

  const showMediaPanel =
    mediaConnectionState === 'connected' || mediaConnectionState === 'reconnecting';

  const canChangePhase = room?.myCapabilities.includes('room:change-phase') ?? false;
  const canManageParticipants = room?.myCapabilities.includes('participant:assign-role') ?? false;
  const isWorkspace = room ? isWorkspaceStage(room.status) : false;
  const canPreviewWorkspace =
    import.meta.env.DEV &&
    room?.status === 'waiting' &&
    (room?.participants.filter((participant) => participant.isActive).length ?? 0) === 1;
  const shouldShowMockWorkspace = !isWorkspace && mockWorkspacePreview;
  const workspaceRoom: RoomDetail | null = room
    ? shouldShowMockWorkspace
      ? { ...room, status: 'warmup' as const }
      : room
    : null;
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
      api(CONTROL_API.ROOMS.REMOVE_PARTICIPANT, {
        params: { id: roomId, userId },
      }),
    onSuccess: async (_, variables) => {
      setPendingRemoval(null);
      await refreshRoomDetail();
      queryClient.invalidateQueries({ queryKey: ['rooms'] }).catch(() => undefined);
      toast.success(t('workspace.removeParticipantSuccess', { name: variables.displayName }));
    },
    onError: async (error) => {
      const apiError = await readApiError(error);
      toast.error(apiError?.message ?? t('workspace.removeParticipantFailed'));
    },
  });

  const lockEditorMutation = useMutation({
    mutationFn: async () =>
      api(CONTROL_API.ROOMS.LOCK_EDITOR, {
        params: { id: roomId },
      }),
    onSuccess: () => {
      setRoom((prev) => (prev ? { ...prev, editorLocked: true } : prev));
      void refreshRoomDetail().catch(() => undefined);
    },
    onError: async (error) => {
      const apiError = await readApiError(error);

      if (apiError?.statusCode === 401) {
        return;
      }

      if (apiError?.statusCode === 409 || apiError?.code === ERROR_CODES.ROOM_EDITOR_LOCKED) {
        setRoom((prev) => (prev ? { ...prev, editorLocked: true } : prev));
        void refreshRoomDetail().catch(() => undefined);
      }

      toast.error(
        resolveErrorMessage(apiError, LOCK_EDITOR_ERROR_KEYS, 'workspace.editorLockedError', t),
      );
    },
  });
  const unlockEditorMutation = useMutation({
    mutationFn: async () =>
      api(CONTROL_API.ROOMS.UNLOCK_EDITOR, {
        params: { id: roomId },
      }),
    onSuccess: () => {
      setRoom((prev) => (prev ? { ...prev, editorLocked: false } : prev));
      void refreshRoomDetail().catch(() => undefined);
    },
    onError: async (error) => {
      const apiError = await readApiError(error);

      if (apiError?.statusCode === 401) {
        return;
      }

      if (apiError?.statusCode === 409 || apiError?.code === ERROR_CODES.ROOM_EDITOR_NOT_LOCKED) {
        setRoom((prev) => (prev ? { ...prev, editorLocked: false } : prev));
        void refreshRoomDetail().catch(() => undefined);
      }

      toast.error(
        resolveErrorMessage(apiError, UNLOCK_EDITOR_ERROR_KEYS, 'workspace.editorUnlockFailed', t),
      );
    },
  });

  const handleLockEditor = useCallback(() => {
    if (room?.editorLocked || lockEditorMutation.isPending) return;
    lockEditorMutation.mutate();
  }, [lockEditorMutation, room?.editorLocked]);
  const handleUnlockEditor = useCallback(() => {
    if (!room?.editorLocked || unlockEditorMutation.isPending) return;
    unlockEditorMutation.mutate();
  }, [room?.editorLocked, unlockEditorMutation]);

  const handleToggleReady = useCallback(async () => {
    try {
      const updated = await api(CONTROL_API.ROOMS.TOGGLE_READY, { params: { id: roomId } });
      setRoom(updated);
    } catch (error) {
      const apiError = await readApiError(error);
      toast.error(apiError?.message ?? t('lobby.readyFailed'));
    }
  }, [roomId, t]);

  const uploadChatMedia = useCallback(
    async (file: File): Promise<ChatAttachment> => {
      const metadata = await api(CONTROL_API.ROOMS.CHAT_MEDIA_UPLOAD_URL, {
        params: { id: roomId },
        body: {
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
        },
      });

      await ky.put(metadata.uploadUrl, {
        body: file,
        headers: {
          'Content-Type': metadata.contentType,
        },
      });

      return {
        kind: toChatAttachmentKind(metadata.contentType),
        key: metadata.key,
        url: metadata.downloadUrl,
        fileName: metadata.fileName,
        mimeType: metadata.contentType,
        sizeBytes: metadata.sizeBytes,
      };
    },
    [roomId],
  );

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

  if (workspaceRoom && (isWorkspace || shouldShowMockWorkspace)) {
    return (
      <>
        {transferDialog}
        {removeParticipantDialog}
        <RoomWorkspace
          room={workspaceRoom}
          currentUserId={stableCurrentUserId}
          roomId={roomId}
          elapsedMs={elapsedMs}
          isTransitioning={isTransitioning}
          isLockingEditor={lockEditorMutation.isPending}
          isUnlockingEditor={unlockEditorMutation.isPending}
          onTransition={handleTransition}
          onLockEditor={handleLockEditor}
          onUnlockEditor={handleUnlockEditor}
          onRoomUpdated={setRoom}
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
          chatMessages={chatMessages}
          chatReadAtByUserId={chatReadAtByUserId}
          onSendChatMessage={(data: ChatSendEventData) => sendChatMessage(data)}
          onToggleChatReaction={(data: ChatReactToggleEventData) => toggleChatReaction(data)}
          onMarkChatRead={(upTo) => markChatRead(upTo)}
          onUploadChatMedia={uploadChatMedia}
          currentUserName={stableCurrentUserName}
          isMockPreview={shouldShowMockWorkspace}
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
          selfMicrophoneEnabled={isMicrophoneEnabled}
          onSelfMicrophoneToggle={() => void toggleMicrophone()}
          dockedVideoPanel={
            showMediaPanel && videoPanelMode === 'docked' ? (
              <DockedVideoPanel tiles={videoTiles} onUndock={() => setVideoPanelMode('floating')} />
            ) : null
          }
          aiInterviewerIdentity={AI_INTERVIEWER_IDENTITY}
          aiInterviewerRealtimeEnabled={AI_INTERVIEWER_REALTIME_ENABLED}
          latestLiveKitDataPacket={latestLiveKitDataPacket}
          publishLiveKitData={publishData}
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
        currentUserId={stableCurrentUserId}
        participants={room.participants}
        language={room.language}
        myCapabilities={room.myCapabilities}
        canChangePhase={canChangePhase}
        canManageParticipants={canManageParticipants}
        isTransitioning={isTransitioning}
        isUpdatingRole={isUpdatingRole}
        isTransferringOwnership={isTransferringOwnership}
        joinNotice={joinNotice}
        canPreviewWorkspace={canPreviewWorkspace}
        collabStatus={collabStatus}
        onParticipantRoleChange={handleParticipantRoleChange}
        onTransferOwnership={handleTransferOwnership}
        onToggleReady={handleToggleReady}
        onTransition={handleTransition}
        onPreviewWorkspace={() => setMockWorkspacePreview(true)}
        onRoomUpdated={setRoom}
        mediaControls={mediaControlsElement}
        localVideoTrack={mediaLocalParticipant?.videoTrack ?? null}
        hasLocalVideo={mediaLocalParticipant?.hasVideo ?? false}
        isCameraEnabled={isCameraEnabled}
        localScreenShareTrack={mediaLocalParticipant?.screenShareTrack ?? null}
        hasLocalScreenShare={mediaLocalParticipant?.hasScreenShare ?? false}
        isScreenShareEnabled={isScreenShareEnabled}
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
        selfMicrophoneEnabled={isMicrophoneEnabled}
        onSelfMicrophoneToggle={() => void toggleMicrophone()}
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

const TRANSITION_ERROR_KEYS: Partial<Record<string, string>> = {
  [ERROR_CODES.ROOM_INVALID_TRANSITION]: 'lobby.invalidTransition',
  [ERROR_CODES.ROOM_NOT_PEER_MODE]: 'lobby.notPeerMode',
  [ERROR_CODES.ROOM_PERMISSION_DENIED]: 'lobby.accessDenied',
  [ERROR_CODES.ROOM_PARTICIPANTS_NOT_READY]: 'lobby.participantsNotReady',
};

const ROLE_UPDATE_ERROR_KEYS: Partial<Record<string, string>> = {
  [ERROR_CODES.ROOM_ROLE_CONSTRAINT_VIOLATION]: 'lobby.roleConstraintViolation',
  [ERROR_CODES.ROOM_ROLES_LOCKED]: 'workspace.rolesLocked',
  [ERROR_CODES.PARTICIPANT_NOT_FOUND]: 'lobby.participantNotFound',
  [ERROR_CODES.ROOM_PERMISSION_DENIED]: 'lobby.accessDenied',
  [ERROR_CODES.ROOM_NOT_PEER_MODE]: 'lobby.notPeerMode',
};

const TRANSFER_ERROR_KEYS: Partial<Record<string, string>> = {
  [ERROR_CODES.PARTICIPANT_CANNOT_TRANSFER_OWNERSHIP]: 'workspace.cannotTransferOwnership',
  [ERROR_CODES.PARTICIPANT_NOT_FOUND]: 'lobby.participantNotFound',
  [ERROR_CODES.ROOM_PERMISSION_DENIED]: 'lobby.accessDenied',
};

const LOCK_EDITOR_ERROR_KEYS: Partial<Record<string, string>> = {
  [ERROR_CODES.ROOM_EDITOR_LOCKED]: 'workspace.editorLockedError',
  [ERROR_CODES.ROOM_NOT_FOUND]: 'lobby.roomNotFound',
  [ERROR_CODES.ROOM_PERMISSION_DENIED]: 'lobby.accessDenied',
  [ERROR_CODES.ROOM_ACCESS_DENIED]: 'lobby.accessDenied',
  [ERROR_CODES.FORBIDDEN]: 'lobby.accessDenied',
};

const UNLOCK_EDITOR_ERROR_KEYS: Partial<Record<string, string>> = {
  [ERROR_CODES.ROOM_NOT_FOUND]: 'lobby.roomNotFound',
  [ERROR_CODES.ROOM_PERMISSION_DENIED]: 'lobby.accessDenied',
  [ERROR_CODES.ROOM_ACCESS_DENIED]: 'lobby.accessDenied',
  [ERROR_CODES.FORBIDDEN]: 'lobby.accessDenied',
};
