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
}

export interface MediaDeviceOption {
  deviceId: string;
  label: string;
}

export interface UseLiveKitOptions {
  url: string | null;
  token: string | null;
  connect: boolean;
}

export interface UseLiveKitResult {
  connectionState: LiveKitConnectionState;
  isMicrophoneEnabled: boolean;
  isCameraEnabled: boolean;
  toggleMicrophone: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  switchDevice: (kind: MediaDeviceKind, deviceId: string) => Promise<void>;
  audioInputDevices: MediaDeviceOption[];
  videoInputDevices: MediaDeviceOption[];
  activeAudioDeviceId: string | null;
  activeVideoDeviceId: string | null;
  setOutputVolume: (volume: number) => void;
  setVideoFilter: (settings: VideoFilterSettings) => Promise<void>;
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

export function useLiveKit({ url, token, connect }: UseLiveKitOptions): UseLiveKitResult {
  const [connectionState, setConnectionState] = useState<LiveKitConnectionState>('disconnected');
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [speakingMap, setSpeakingMap] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [remoteParticipants, setRemoteParticipants] = useState<MediaParticipant[]>([]);
  const [localParticipant, setLocalParticipant] = useState<MediaParticipant | null>(null);
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceOption[]>([]);
  const [videoInputDevices, setVideoInputDevices] = useState<MediaDeviceOption[]>([]);
  const [activeAudioDeviceId, setActiveAudioDeviceId] = useState<string | null>(null);
  const [activeVideoDeviceId, setActiveVideoDeviceId] = useState<string | null>(null);

  const roomRef = useRef<Room | null>(null);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const micEnabledOnceRef = useRef(false);
  const videoProcessorRef = useRef<VideoFilterProcessor | null>(null);

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
    setLocalParticipant({
      identity: room.localParticipant.identity,
      isMuted: !room.localParticipant.isMicrophoneEnabled,
      hasVideo: localMediaTrack !== null,
      videoTrack: localMediaTrack,
    });

    const remotes: MediaParticipant[] = [];
    for (const p of room.remoteParticipants.values()) {
      const videoPub = p.getTrackPublication(Track.Source.Camera);
      const audioPub = p.getTrackPublication(Track.Source.Microphone);
      const mediaTrack = videoPub?.isMuted ? null : (videoPub?.track?.mediaStreamTrack ?? null);
      remotes.push({
        identity: p.identity,
        isMuted: !audioPub || audioPub.isMuted,
        hasVideo: mediaTrack !== null,
        videoTrack: mediaTrack,
      });
    }
    setRemoteParticipants(remotes);
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

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true },
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
      if (pub.source === Track.Source.Camera) setIsCameraEnabled(true);
      else if (pub.source === Track.Source.Microphone) setIsMicrophoneEnabled(true);
      refreshParticipants();
    };

    const onLocalTrackUnpublished = (pub: LocalTrackPublication) => {
      if (disposed) return;
      if (pub.source === Track.Source.Camera) setIsCameraEnabled(false);
      else if (pub.source === Track.Source.Microphone) setIsMicrophoneEnabled(false);
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
    await room.localParticipant.setMicrophoneEnabled(!enabled);
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

  const setVideoFilter = useCallback(async (settings: VideoFilterSettings) => {
    const room = roomRef.current;
    if (!room) return;

    const isDefault = settings.brightness === 1 && settings.contrast === 1;
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

  return {
    connectionState,
    isMicrophoneEnabled,
    isCameraEnabled,
    toggleMicrophone,
    toggleCamera,
    switchDevice,
    audioInputDevices,
    videoInputDevices,
    activeAudioDeviceId,
    activeVideoDeviceId,
    setOutputVolume,
    setVideoFilter,
    speakingMap,
    remoteParticipants,
    localParticipant,
  };
}
