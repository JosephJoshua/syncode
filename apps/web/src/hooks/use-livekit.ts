import {
  type ConnectionQuality,
  ConnectionState,
  type LocalTrackPublication,
  type Participant,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
  Room,
  RoomEvent,
  Track,
} from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { VideoFilterProcessor, type VideoFilterSettings } from '@/lib/video-filter-processor.js';

export type LiveKitConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';

export interface MediaParticipant {
  identity: string;
  isMuted: boolean;
  hasVideo: boolean;
  videoTrack: MediaStreamTrack | null;
  hasScreenShare: boolean;
  screenShareTrack: MediaStreamTrack | null;
}

export interface MediaDeviceOption {
  deviceId: string;
  label: string;
}

export interface AudioProcessingOptions {
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
}

function speakingMapsEqual(
  prev: ReadonlyMap<string, boolean>,
  next: ReadonlyMap<string, boolean>,
): boolean {
  if (prev.size !== next.size) return false;
  for (const [k, v] of next) {
    if (prev.get(k) !== v) return false;
  }
  return true;
}

export interface UseLiveKitOptions {
  url: string | null;
  token: string | null;
  connect: boolean;
  audioProcessing?: AudioProcessingOptions;
  preferredAudioDeviceId?: string | null;
  preferredVideoDeviceId?: string | null;
  onDevicesDiscovered?: (devices: {
    audioInputIds: ReadonlySet<string>;
    videoInputIds: ReadonlySet<string>;
    audioOutputIds: ReadonlySet<string>;
  }) => void;
}

export interface UseLiveKitResult {
  connectionState: LiveKitConnectionState;
  isMicrophoneEnabled: boolean;
  isCameraEnabled: boolean;
  isScreenShareEnabled: boolean;
  toggleMicrophone: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  switchDevice: (kind: MediaDeviceKind, deviceId: string) => Promise<void>;
  audioInputDevices: MediaDeviceOption[];
  videoInputDevices: MediaDeviceOption[];
  activeAudioDeviceId: string | null;
  activeVideoDeviceId: string | null;
  setOutputVolume: (volume: number) => void;
  setParticipantVolume: (identity: string, volume: number) => void;
  setParticipantMuted: (identity: string, muted: boolean) => void;
  setParticipantVideoHidden: (identity: string, hidden: boolean) => void;
  participantVolumeMap: ReadonlyMap<string, number>;
  localMuteSet: ReadonlySet<string>;
  videoHiddenSet: ReadonlySet<string>;
  setVideoFilter: (settings: VideoFilterSettings) => Promise<void>;
  setAudioProcessing: (settings: {
    noiseSuppression: boolean;
    echoCancellation: boolean;
    autoGainControl: boolean;
  }) => Promise<void>;
  connectionQualityMap: ReadonlyMap<string, ConnectionQuality>;
  isPushToTalkMode: boolean;
  togglePushToTalkMode: () => void;
  handlePushToTalk: (pressed: boolean) => void;
  speakingMap: ReadonlyMap<string, boolean>;
  remoteParticipants: MediaParticipant[];
  localParticipant: MediaParticipant | null;
}

function mapConnectionState(state: ConnectionState): LiveKitConnectionState {
  switch (state) {
    case ConnectionState.Connected:
      return 'connected';
    case ConnectionState.Connecting:
      return 'connecting';
    case ConnectionState.Reconnecting:
      return 'reconnecting';
    default:
      return 'disconnected';
  }
}

function participantEqual(a: MediaParticipant, b: MediaParticipant): boolean {
  return (
    a.identity === b.identity &&
    a.isMuted === b.isMuted &&
    a.hasVideo === b.hasVideo &&
    a.videoTrack === b.videoTrack &&
    a.hasScreenShare === b.hasScreenShare &&
    a.screenShareTrack === b.screenShareTrack
  );
}

export function useLiveKit({
  url,
  token,
  connect,
  audioProcessing,
  preferredAudioDeviceId,
  preferredVideoDeviceId,
  onDevicesDiscovered,
}: UseLiveKitOptions): UseLiveKitResult {
  const [connectionState, setConnectionState] = useState<LiveKitConnectionState>('disconnected');
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isScreenShareEnabled, setIsScreenShareEnabled] = useState(false);
  const [isPushToTalkMode, setIsPushToTalkMode] = useState(false);
  const [speakingMap, setSpeakingMap] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [connectionQualityMap, setConnectionQualityMap] = useState<
    ReadonlyMap<string, ConnectionQuality>
  >(new Map());
  const [remoteParticipants, setRemoteParticipants] = useState<MediaParticipant[]>([]);
  const [localParticipant, setLocalParticipant] = useState<MediaParticipant | null>(null);
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceOption[]>([]);
  const [videoInputDevices, setVideoInputDevices] = useState<MediaDeviceOption[]>([]);
  const [activeAudioDeviceId, setActiveAudioDeviceId] = useState<string | null>(null);
  const [activeVideoDeviceId, setActiveVideoDeviceId] = useState<string | null>(null);
  const [participantVolumeMap, setParticipantVolumeMap] = useState<ReadonlyMap<string, number>>(
    new Map(),
  );
  const [localMuteSet, setLocalMuteSet] = useState<ReadonlySet<string>>(new Set());
  const [videoHiddenSet, setVideoHiddenSet] = useState<ReadonlySet<string>>(new Set());
  const localMuteRef = useRef(localMuteSet);
  localMuteRef.current = localMuteSet;
  const volumeMapRef = useRef(participantVolumeMap);
  volumeMapRef.current = participantVolumeMap;

  const roomRef = useRef<Room | null>(null);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const videoProcessorRef = useRef<VideoFilterProcessor | null>(null);
  const pendingVideoFilterRef = useRef<VideoFilterSettings | null>(null);

  const audioProcessingRef = useRef(audioProcessing);
  audioProcessingRef.current = audioProcessing;

  const preferredAudioDeviceIdRef = useRef(preferredAudioDeviceId);
  preferredAudioDeviceIdRef.current = preferredAudioDeviceId;
  const preferredVideoDeviceIdRef = useRef(preferredVideoDeviceId);
  preferredVideoDeviceIdRef.current = preferredVideoDeviceId;

  const onDevicesDiscoveredRef = useRef(onDevicesDiscovered);
  onDevicesDiscoveredRef.current = onDevicesDiscovered;

  const refreshParticipants = useCallback(() => {
    const room = roomRef.current;
    if (!room) {
      setRemoteParticipants([]);
      setLocalParticipant(null);
      return;
    }

    const localVideo = room.localParticipant.getTrackPublication(Track.Source.Camera);
    const rawLocalTrack = localVideo?.isMuted
      ? null
      : (localVideo?.track?.mediaStreamTrack ?? null);
    const localMediaTrack =
      rawLocalTrack && videoProcessorRef.current?.processedTrack
        ? videoProcessorRef.current.processedTrack
        : rawLocalTrack;
    const localHasVideo =
      localMediaTrack !== null ||
      (room.localParticipant.isCameraEnabled && !!localVideo && !localVideo.isMuted);
    const localScreen = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
    const localScreenTrack = localScreen?.isMuted
      ? null
      : (localScreen?.track?.mediaStreamTrack ?? null);
    const nextLocal: MediaParticipant = {
      identity: room.localParticipant.identity,
      isMuted: !room.localParticipant.isMicrophoneEnabled,
      hasVideo: localHasVideo,
      videoTrack: localMediaTrack,
      hasScreenShare: localScreenTrack !== null,
      screenShareTrack: localScreenTrack,
    };
    setLocalParticipant((prev) => {
      if (prev && participantEqual(prev, nextLocal)) return prev;
      return nextLocal;
    });

    const remotes: MediaParticipant[] = [];
    for (const p of room.remoteParticipants.values()) {
      const videoPub = p.getTrackPublication(Track.Source.Camera);
      const audioPub = p.getTrackPublication(Track.Source.Microphone);
      const screenPub = p.getTrackPublication(Track.Source.ScreenShare);
      const mediaTrack = videoPub?.isMuted ? null : (videoPub?.track?.mediaStreamTrack ?? null);
      const screenTrack = screenPub?.isMuted ? null : (screenPub?.track?.mediaStreamTrack ?? null);
      remotes.push({
        identity: p.identity,
        isMuted: !audioPub || audioPub.isMuted,
        hasVideo: mediaTrack !== null,
        videoTrack: mediaTrack,
        hasScreenShare: screenTrack !== null,
        screenShareTrack: screenTrack,
      });
    }
    setRemoteParticipants((prev) => {
      if (
        prev.length === remotes.length &&
        prev.every((participant, index) => {
          const next = remotes[index];
          return next !== undefined && participantEqual(participant, next);
        })
      ) {
        return prev;
      }

      return remotes;
    });
  }, []);

  const refreshDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputDevices(
        devices
          .filter((d) => d.kind === 'audioinput' && d.deviceId)
          .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` })),
      );
      setVideoInputDevices(
        devices
          .filter((d) => d.kind === 'videoinput' && d.deviceId)
          .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` })),
      );

      const cb = onDevicesDiscoveredRef.current;
      if (cb) {
        const audioInputIds = new Set(
          devices.filter((d) => d.kind === 'audioinput' && d.deviceId).map((d) => d.deviceId),
        );
        const videoInputIds = new Set(
          devices.filter((d) => d.kind === 'videoinput' && d.deviceId).map((d) => d.deviceId),
        );
        const audioOutputIds = new Set(
          devices.filter((d) => d.kind === 'audiooutput' && d.deviceId).map((d) => d.deviceId),
        );
        cb({ audioInputIds, videoInputIds, audioOutputIds });
      }

      const room = roomRef.current;
      if (room) {
        setActiveAudioDeviceId(room.localParticipant.activeDeviceMap.get('audioinput') ?? null);
        setActiveVideoDeviceId(room.localParticipant.activeDeviceMap.get('videoinput') ?? null);
      }
    } catch {
      // permissions denied or no devices
    }
  }, []);

  const cleanupAudio = useCallback(() => {
    for (const el of audioElementsRef.current.values()) {
      el.srcObject = null;
      el.remove();
    }
    audioElementsRef.current.clear();
  }, []);

  const resetState = useCallback(() => {
    cleanupAudio();
    if (videoProcessorRef.current) {
      void videoProcessorRef.current.destroy();
      videoProcessorRef.current = null;
    }
    setConnectionState('disconnected');
    setSpeakingMap(new Map());
    setConnectionQualityMap(new Map());
    setRemoteParticipants([]);
    setLocalParticipant(null);
    setIsMicrophoneEnabled(false);
    setIsCameraEnabled(false);
    setIsScreenShareEnabled(false);
    setAudioInputDevices([]);
    setVideoInputDevices([]);
    setActiveAudioDeviceId(null);
    setActiveVideoDeviceId(null);
  }, [cleanupAudio]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: callback refs are stable
  useEffect(() => {
    if (!url || !token || !connect) {
      if (roomRef.current) {
        void roomRef.current.disconnect();
        roomRef.current = null;
      }
      resetState();
      return;
    }

    const ap = audioProcessingRef.current;
    const preferredAudio = preferredAudioDeviceIdRef.current;
    const preferredVideo = preferredVideoDeviceIdRef.current;
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: {
        echoCancellation: ap?.echoCancellation ?? true,
        noiseSuppression: ap?.noiseSuppression ?? true,
        autoGainControl: ap?.autoGainControl ?? false,
        deviceId: preferredAudio ?? undefined,
      },
      videoCaptureDefaults: {
        resolution: { width: 640, height: 480, frameRate: 24 },
        deviceId: preferredVideo ?? undefined,
      },
    });

    roomRef.current = room;
    let disposed = false;

    const onConnectionStateChanged = (state: ConnectionState) => {
      if (disposed) return;
      setConnectionState(mapConnectionState(state));
    };

    const onActiveSpeakersChanged = (speakers: { identity: string }[]) => {
      if (disposed) return;
      const speakerSet = new Set(speakers.map((s) => s.identity));
      setSpeakingMap((prev) => {
        const next = new Map<string, boolean>();
        if (roomRef.current) {
          next.set(
            roomRef.current.localParticipant.identity,
            speakerSet.has(roomRef.current.localParticipant.identity),
          );
          for (const p of roomRef.current.remoteParticipants.values()) {
            next.set(p.identity, speakerSet.has(p.identity));
          }
        }
        return speakingMapsEqual(prev, next) ? prev : next;
      });
    };

    const onTrackSubscribed = (
      track: RemoteTrack,
      pub: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      if (disposed) return;
      if (track.kind === Track.Kind.Audio) {
        const audioKey = `${participant.identity}:${pub.source}`;
        const existing = audioElementsRef.current.get(audioKey);
        if (existing) {
          existing.srcObject = null;
          existing.remove();
        }
        const el = track.attach();
        if (localMuteRef.current.has(participant.identity)) el.muted = true;
        const vol = volumeMapRef.current.get(participant.identity);
        if (vol !== undefined) el.volume = vol;
        audioElementsRef.current.set(audioKey, el);
      }
      refreshParticipants();
    };

    const onTrackUnsubscribed = (
      _track: RemoteTrack,
      pub: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      if (disposed) return;
      const audioKey = `${participant.identity}:${pub.source}`;
      const el = audioElementsRef.current.get(audioKey);
      if (el) {
        el.srcObject = null;
        el.remove();
        audioElementsRef.current.delete(audioKey);
      }
      refreshParticipants();
    };

    const onLocalTrackPublished = (pub: LocalTrackPublication) => {
      if (disposed) return;
      if (pub.source === Track.Source.Camera) {
        setIsCameraEnabled(true);
        const pending = pendingVideoFilterRef.current;
        if (pending && (pending.brightness !== 1 || pending.contrast !== 1) && pub.track) {
          const processor = new VideoFilterProcessor();
          processor.updateSettings(pending);
          videoProcessorRef.current = processor;
          void pub.track.setProcessor(processor, true);
        }
      } else if (pub.source === Track.Source.Microphone) {
        setIsMicrophoneEnabled(true);
      } else if (pub.source === Track.Source.ScreenShare) {
        setIsScreenShareEnabled(true);
      }
      refreshParticipants();
    };

    const onLocalTrackUnpublished = (pub: LocalTrackPublication) => {
      if (disposed) return;
      if (pub.source === Track.Source.Camera) setIsCameraEnabled(false);
      else if (pub.source === Track.Source.Microphone) setIsMicrophoneEnabled(false);
      else if (pub.source === Track.Source.ScreenShare) setIsScreenShareEnabled(false);
      refreshParticipants();
    };

    const onTrackMuted = () => {
      if (!disposed) refreshParticipants();
    };
    const onTrackUnmuted = () => {
      if (!disposed) refreshParticipants();
    };
    const onParticipantConnected = () => {
      if (!disposed) refreshParticipants();
    };
    const onParticipantDisconnected = (p: RemoteParticipant) => {
      if (disposed) return;
      for (const [key, el] of audioElementsRef.current) {
        if (key.startsWith(`${p.identity}:`)) {
          el.srcObject = null;
          el.remove();
          audioElementsRef.current.delete(key);
        }
      }
      refreshParticipants();
    };

    const onDisconnected = () => {
      if (!disposed) resetState();
    };

    room.on(RoomEvent.ConnectionStateChanged, onConnectionStateChanged);
    room.on(RoomEvent.ActiveSpeakersChanged, onActiveSpeakersChanged);
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
    room.on(RoomEvent.LocalTrackPublished, onLocalTrackPublished);
    room.on(RoomEvent.LocalTrackUnpublished, onLocalTrackUnpublished);
    room.on(RoomEvent.LocalTrackSubscribed, () => {
      if (!disposed) refreshParticipants();
    });
    room.on(RoomEvent.TrackMuted, onTrackMuted);
    room.on(RoomEvent.TrackUnmuted, onTrackUnmuted);
    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    room.on(RoomEvent.Disconnected, onDisconnected);
    room.on(
      RoomEvent.ConnectionQualityChanged,
      (quality: ConnectionQuality, participant: Participant) => {
        if (disposed) return;
        setConnectionQualityMap((prev) => {
          if (prev.get(participant.identity) === quality) return prev;
          const next = new Map(prev);
          next.set(participant.identity, quality);
          return next;
        });
      },
    );
    room.on(RoomEvent.ActiveDeviceChanged, () => void refreshDevices());

    const onDeviceChange = () => void refreshDevices();
    navigator.mediaDevices.addEventListener('devicechange', onDeviceChange);

    setConnectionState('connecting');

    room
      .connect(url, token)
      .then(() => {
        if (disposed) return;
        setConnectionState('connected');
        refreshParticipants();
        void refreshDevices();
      })
      .catch((err: unknown) => {
        if (disposed) return;
        console.error('[LiveKit] Connection failed:', err);
        setConnectionState('failed');
      });

    return () => {
      disposed = true;
      navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange);
      cleanupAudio();
      void room.disconnect();
      if (roomRef.current === room) {
        roomRef.current = null;
      }
    };
  }, [url, token, connect]);

  const toggleMicrophone = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const enabled = room.localParticipant.isMicrophoneEnabled;
    if (enabled) {
      await room.localParticipant.setMicrophoneEnabled(false);
    } else {
      const ap = audioProcessingRef.current;
      await room.localParticipant.setMicrophoneEnabled(
        true,
        ap
          ? {
              noiseSuppression: ap.noiseSuppression,
              echoCancellation: ap.echoCancellation,
              autoGainControl: ap.autoGainControl,
            }
          : undefined,
      );
    }
    setIsMicrophoneEnabled(!enabled);
  }, []);

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const target = !room.localParticipant.isCameraEnabled;
    try {
      await room.localParticipant.setCameraEnabled(target);
    } catch (err) {
      console.warn('[LiveKit] Camera toggle failed:', err);
    }
    // Sync from the authoritative room state so a denied permission leaves
    // the camera off regardless of the requested target.
    setIsCameraEnabled(room.localParticipant.isCameraEnabled);
    refreshParticipants();
  }, [refreshParticipants]);

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const enabled = room.localParticipant.isScreenShareEnabled;
    try {
      await room.localParticipant.setScreenShareEnabled(!enabled, { audio: true });
      setIsScreenShareEnabled(!enabled);
      refreshParticipants();
    } catch {
      setIsScreenShareEnabled(false);
      refreshParticipants();
    }
  }, [refreshParticipants]);

  const togglePushToTalkMode = useCallback(() => {
    setIsPushToTalkMode((prev) => {
      const next = !prev;
      const room = roomRef.current;
      if (next && room?.localParticipant.isMicrophoneEnabled) {
        void room.localParticipant.setMicrophoneEnabled(false);
        setIsMicrophoneEnabled(false);
      }
      return next;
    });
  }, []);

  const handlePushToTalk = useCallback((pressed: boolean) => {
    const room = roomRef.current;
    if (!room) return;
    const ap = audioProcessingRef.current;
    if (pressed) {
      void room.localParticipant.setMicrophoneEnabled(
        true,
        ap
          ? {
              noiseSuppression: ap.noiseSuppression,
              echoCancellation: ap.echoCancellation,
              autoGainControl: ap.autoGainControl,
            }
          : undefined,
      );
      setIsMicrophoneEnabled(true);
    } else {
      void room.localParticipant.setMicrophoneEnabled(false);
      setIsMicrophoneEnabled(false);
    }
  }, []);

  const switchDevice = useCallback(
    async (kind: MediaDeviceKind, deviceId: string) => {
      const room = roomRef.current;
      if (!room) return;
      try {
        await room.switchActiveDevice(kind, deviceId);
        if (kind === 'audioinput') setActiveAudioDeviceId(deviceId);
        else if (kind === 'videoinput') setActiveVideoDeviceId(deviceId);
        refreshParticipants();
      } catch (err) {
        console.warn('[LiveKit] Device switch failed, refreshing tracks:', err);
        refreshParticipants();
        void refreshDevices();
      }
    },
    [refreshParticipants, refreshDevices],
  );

  const setOutputVolume = useCallback((volume: number) => {
    for (const el of audioElementsRef.current.values()) {
      el.volume = Math.max(0, Math.min(1, volume));
    }
  }, []);

  const setParticipantVolume = useCallback((identity: string, volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume));
    setParticipantVolumeMap((prev) => {
      const next = new Map(prev);
      next.set(identity, clamped);
      return next;
    });
    for (const [key, el] of audioElementsRef.current) {
      if (key.startsWith(`${identity}:`)) el.volume = clamped;
    }
  }, []);

  const setParticipantMuted = useCallback((identity: string, muted: boolean) => {
    setLocalMuteSet((prev) => {
      const next = new Set(prev);
      if (muted) next.add(identity);
      else next.delete(identity);
      return next;
    });
    for (const [key, el] of audioElementsRef.current) {
      if (key.startsWith(`${identity}:`)) el.muted = muted;
    }
  }, []);

  const setParticipantVideoHidden = useCallback((identity: string, hidden: boolean) => {
    setVideoHiddenSet((prev) => {
      const next = new Set(prev);
      if (hidden) next.add(identity);
      else next.delete(identity);
      return next;
    });
  }, []);

  const setVideoFilter = useCallback(
    async (settings: VideoFilterSettings) => {
      const isDefault = settings.brightness === 1 && settings.contrast === 1;
      pendingVideoFilterRef.current = isDefault ? null : settings;

      const room = roomRef.current;
      if (!room) return;

      const cameraPub = room.localParticipant.getTrackPublication(Track.Source.Camera);

      if (isDefault) {
        if (videoProcessorRef.current && cameraPub?.track) {
          await cameraPub.track.stopProcessor();
          videoProcessorRef.current = null;
          refreshParticipants();
        }
        return;
      }

      if (videoProcessorRef.current) {
        videoProcessorRef.current.updateSettings(settings);
        return;
      }

      if (!cameraPub?.track) return;

      const processor = new VideoFilterProcessor();
      processor.updateSettings(settings);
      videoProcessorRef.current = processor;
      await cameraPub.track.setProcessor(processor, true);
      refreshParticipants();
    },
    [refreshParticipants],
  );

  const setAudioProcessing = useCallback(
    async (settings: {
      noiseSuppression: boolean;
      echoCancellation: boolean;
      autoGainControl: boolean;
    }) => {
      const room = roomRef.current;
      if (!room || !room.localParticipant.isMicrophoneEnabled) return;
      try {
        await room.localParticipant.setMicrophoneEnabled(false);
        await room.localParticipant.setMicrophoneEnabled(true, {
          noiseSuppression: settings.noiseSuppression,
          echoCancellation: settings.echoCancellation,
          autoGainControl: settings.autoGainControl,
        });
        setIsMicrophoneEnabled(true);
      } catch (err) {
        console.warn('[LiveKit] Failed to update audio processing:', err);
        setIsMicrophoneEnabled(room.localParticipant.isMicrophoneEnabled);
      }
    },
    [],
  );

  return {
    connectionState,
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
    setAudioProcessing,
    connectionQualityMap,
    isPushToTalkMode,
    togglePushToTalkMode,
    handlePushToTalk,
    speakingMap,
    remoteParticipants,
    localParticipant,
  };
}
