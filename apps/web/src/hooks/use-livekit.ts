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

export type LiveKitConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';

export interface MediaParticipant {
  identity: string;
  hasVideo: boolean;
  videoTrack: MediaStreamTrack | null;
}

export interface UseLiveKitOptions {
  url: string | null;
  token: string | null;
  connect: boolean;
}

export interface MediaDeviceOption {
  deviceId: string;
  label: string;
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
      hasVideo: localMediaTrack !== null,
      videoTrack: localMediaTrack,
    });

    const remotes: MediaParticipant[] = [];
    for (const p of room.remoteParticipants.values()) {
      const videoPub = p.getTrackPublication(Track.Source.Camera);
      const mediaTrack = videoPub?.isMuted ? null : (videoPub?.track?.mediaStreamTrack ?? null);
      remotes.push({
        identity: p.identity,
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshParticipants/cleanupAudio/resetState are stable useCallback refs
  useEffect(() => {
    if (!url || !token || !connect) {
      if (roomRef.current) {
        void roomRef.current.disconnect();
        roomRef.current = null;
      }
      resetState();
      return;
    }

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true },
      videoCaptureDefaults: { resolution: { width: 640, height: 480, frameRate: 24 } },
    });

    roomRef.current = room;

    const onConnectionStateChanged = (state: ConnectionState) => {
      setConnectionState(mapConnectionState(state));
    };

    const onActiveSpeakersChanged = (speakers: { identity: string }[]) => {
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
      const el = audioElementsRef.current.get(participant.identity);
      if (el) {
        el.srcObject = null;
        el.remove();
        audioElementsRef.current.delete(participant.identity);
      }
      refreshParticipants();
    };

    const onLocalTrackPublished = (pub: LocalTrackPublication) => {
      if (pub.source === Track.Source.Camera) setIsCameraEnabled(true);
      else if (pub.source === Track.Source.Microphone) setIsMicrophoneEnabled(true);
      refreshParticipants();
    };

    const onLocalTrackUnpublished = (pub: LocalTrackPublication) => {
      if (pub.source === Track.Source.Camera) setIsCameraEnabled(false);
      else if (pub.source === Track.Source.Microphone) setIsMicrophoneEnabled(false);
      refreshParticipants();
    };

    const onTrackMuted = () => refreshParticipants();
    const onTrackUnmuted = () => refreshParticipants();
    const onParticipantConnected = () => refreshParticipants();
    const onParticipantDisconnected = (p: RemoteParticipant) => {
      const el = audioElementsRef.current.get(p.identity);
      if (el) {
        el.srcObject = null;
        el.remove();
        audioElementsRef.current.delete(p.identity);
      }
      refreshParticipants();
    };

    const onDisconnected = () => resetState();

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
        setConnectionState('connected');
        await room.localParticipant.setMicrophoneEnabled(true);
        setIsMicrophoneEnabled(true);
        refreshParticipants();
        void refreshDevices();
      })
      .catch((err) => {
        console.error('[LiveKit] Connection failed:', err);
        setConnectionState('failed');
      });

    return () => {
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
  }, []);

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const enabled = room.localParticipant.isCameraEnabled;
    await room.localParticipant.setCameraEnabled(!enabled);
    setIsCameraEnabled(!enabled);
    refreshParticipants();
  }, [refreshParticipants]);

  const switchDevice = useCallback(async (kind: MediaDeviceKind, deviceId: string) => {
    const room = roomRef.current;
    if (!room) return;
    await room.switchActiveDevice(kind, deviceId);
    if (kind === 'audioinput') setActiveAudioDeviceId(deviceId);
    else if (kind === 'videoinput') setActiveVideoDeviceId(deviceId);
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
    speakingMap,
    remoteParticipants,
    localParticipant,
  };
}
