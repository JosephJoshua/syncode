import {
  ConnectionState,
  type LocalTrackPublication,
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

export interface UseLiveKitOptions {
  url: string | null;
  token: string | null;
  connect: boolean;
  audioProcessing?: AudioProcessingOptions;
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
}: UseLiveKitOptions): UseLiveKitResult {
  const [connectionState, setConnectionState] = useState<LiveKitConnectionState>('disconnected');
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isScreenShareEnabled, setIsScreenShareEnabled] = useState(false);
  const [speakingMap, setSpeakingMap] = useState<ReadonlyMap<string, boolean>>(new Map());
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
  const micEnabledOnceRef = useRef(false);
  const videoProcessorRef = useRef<VideoFilterProcessor | null>(null);
  const pendingVideoFilterRef = useRef<VideoFilterSettings | null>(null);

  const audioProcessingRef = useRef(audioProcessing);
  audioProcessingRef.current = audioProcessing;

  const refreshParticipants = useCallback(() => {
    const room = roomRef.current;
    if (!room) {
      setRemoteParticipants([]);
      setLocalParticipant(null);
      return;
    }

    const localVideo = room.localParticipant.getTrackPublication(Track.Source.Camera);
    const localMediaTrack = localVideo?.isMuted
      ? null
      : (localVideo?.track?.mediaStreamTrack ?? null);
    const localScreen = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
    const localScreenTrack = localScreen?.isMuted
      ? null
      : (localScreen?.track?.mediaStreamTrack ?? null);
    const nextLocal: MediaParticipant = {
      identity: room.localParticipant.identity,
      isMuted: !room.localParticipant.isMicrophoneEnabled,
      hasVideo: localMediaTrack !== null,
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
      if (prev.length === remotes.length && prev.every((p, i) => participantEqual(p, remotes[i]!)))
        return prev;
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
      micEnabledOnceRef.current = false;
      return;
    }

    const ap = audioProcessingRef.current;
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: {
        echoCancellation: ap?.echoCancellation ?? true,
        noiseSuppression: ap?.noiseSuppression ?? true,
        autoGainControl: ap?.autoGainControl ?? false,
      },
      videoCaptureDefaults: { resolution: { width: 640, height: 480, frameRate: 24 } },
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
        if (prev.size === next.size && [...next].every(([k, v]) => prev.get(k) === v)) {
          return prev;
        }
        return next;
      });
    };

    const onTrackSubscribed = (
      track: RemoteTrack,
      _pub: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      if (disposed) return;
      if (track.kind === Track.Kind.Audio) {
        const existing = audioElementsRef.current.get(participant.identity);
        if (existing) {
          existing.srcObject = null;
          existing.remove();
        }
        const el = track.attach();
        if (localMuteRef.current.has(participant.identity)) el.muted = true;
        const vol = volumeMapRef.current.get(participant.identity);
        if (vol !== undefined) el.volume = vol;
        audioElementsRef.current.set(participant.identity, el);
      }
      refreshParticipants();
    };

    const onTrackUnsubscribed = (
      _track: RemoteTrack,
      _pub: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      if (disposed) return;
      const el = audioElementsRef.current.get(participant.identity);
      if (el) {
        el.srcObject = null;
        el.remove();
        audioElementsRef.current.delete(participant.identity);
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
      const el = audioElementsRef.current.get(p.identity);
      if (el) {
        el.srcObject = null;
        el.remove();
        audioElementsRef.current.delete(p.identity);
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
    room.on(RoomEvent.TrackMuted, onTrackMuted);
    room.on(RoomEvent.TrackUnmuted, onTrackUnmuted);
    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    room.on(RoomEvent.Disconnected, onDisconnected);
    room.on(RoomEvent.ActiveDeviceChanged, () => void refreshDevices());

    const onDeviceChange = () => void refreshDevices();
    navigator.mediaDevices.addEventListener('devicechange', onDeviceChange);

    setConnectionState('connecting');

    room
      .connect(url, token)
      .then(async () => {
        if (disposed) return;
        setConnectionState('connected');
        refreshParticipants();
        void refreshDevices();

        if (!micEnabledOnceRef.current) {
          try {
            await room.localParticipant.setMicrophoneEnabled(true);
            setIsMicrophoneEnabled(true);
            micEnabledOnceRef.current = true;
          } catch (err) {
            console.warn('[LiveKit] Could not auto-enable microphone:', err);
          }
        }
      })
      .catch((err) => {
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
    micEnabledOnceRef.current = true;
  }, []);

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const enabled = room.localParticipant.isCameraEnabled;
    await room.localParticipant.setCameraEnabled(!enabled);
    setIsCameraEnabled(!enabled);
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
    const el = audioElementsRef.current.get(identity);
    if (el) el.volume = clamped;
  }, []);

  const setParticipantMuted = useCallback((identity: string, muted: boolean) => {
    setLocalMuteSet((prev) => {
      const next = new Set(prev);
      if (muted) next.add(identity);
      else next.delete(identity);
      return next;
    });
    const el = audioElementsRef.current.get(identity);
    if (el) el.muted = muted;
  }, []);

  const setParticipantVideoHidden = useCallback((identity: string, hidden: boolean) => {
    setVideoHiddenSet((prev) => {
      const next = new Set(prev);
      if (hidden) next.add(identity);
      else next.delete(identity);
      return next;
    });
  }, []);

  const setVideoFilter = useCallback(async (settings: VideoFilterSettings) => {
    const isDefault = settings.brightness === 1 && settings.contrast === 1;
    pendingVideoFilterRef.current = isDefault ? null : settings;

    const room = roomRef.current;
    if (!room) return;

    const cameraPub = room.localParticipant.getTrackPublication(Track.Source.Camera);

    if (isDefault) {
      if (videoProcessorRef.current && cameraPub?.track) {
        await cameraPub.track.stopProcessor();
        videoProcessorRef.current = null;
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
  }, []);

  const setAudioProcessing = useCallback(
    async (settings: {
      noiseSuppression: boolean;
      echoCancellation: boolean;
      autoGainControl: boolean;
    }) => {
      const room = roomRef.current;
      if (!room || !room.localParticipant.isMicrophoneEnabled) return;
      await room.localParticipant.setMicrophoneEnabled(false);
      await room.localParticipant.setMicrophoneEnabled(true, {
        noiseSuppression: settings.noiseSuppression,
        echoCancellation: settings.echoCancellation,
        autoGainControl: settings.autoGainControl,
      });
      setIsMicrophoneEnabled(true);
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
    speakingMap,
    remoteParticipants,
    localParticipant,
  };
}
