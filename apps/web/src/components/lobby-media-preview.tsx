import { Button, cn, Select, SelectContent, SelectItem, SelectTrigger } from '@syncode/ui';
import { Mic, MicOff, Settings, Shield, Sparkles, Video, VideoOff } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMediaSettingsStore } from '@/stores/media-settings.store.js';

interface DeviceOption {
  deviceId: string;
  label: string;
}

type PermissionStatus = 'idle' | 'prompting' | 'granted' | 'denied';

const BAR_COUNT = 12;
const BAR_KEYS = Array.from({ length: BAR_COUNT }, (_, i) => `bar-${String(i)}`);

async function acquireStream(
  constraints: MediaStreamConstraints,
  signal: { cancelled: boolean },
  onStream: (stream: MediaStream) => void,
  onDenied: (err: DOMException) => void,
): Promise<void> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    if (signal.cancelled) {
      for (const track of stream.getTracks()) track.stop();
      return;
    }
    onStream(stream);
  } catch (err) {
    if (signal.cancelled) return;
    onDenied(err as DOMException);
  }
}

export function LobbyMediaPreview() {
  const { t } = useTranslation('rooms');

  const preferredAudioId = useMediaSettingsStore((s) => s.audioInputDeviceId);
  const preferredVideoId = useMediaSettingsStore((s) => s.videoInputDeviceId);
  const setPreferredAudioId = useMediaSettingsStore((s) => s.setAudioInputDeviceId);
  const setPreferredVideoId = useMediaSettingsStore((s) => s.setVideoInputDeviceId);
  const audioProcessing = useMediaSettingsStore((s) => s.audioProcessing);
  const setAudioProcessing = useMediaSettingsStore((s) => s.setAudioProcessing);
  const reconcileDevices = useMediaSettingsStore((s) => s.reconcileDevices);

  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [permission, setPermission] = useState<PermissionStatus>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [videoDevices, setVideoDevices] = useState<DeviceOption[]>([]);
  const [audioDevices, setAudioDevices] = useState<DeviceOption[]>([]);
  const [level, setLevel] = useState(0);
  const [showDeviceRow, setShowDeviceRow] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRafRef = useRef<number | null>(null);
  const prevBarRef = useRef(0);
  const videoRefreshedRef = useRef(false);
  const audioRefreshedRef = useRef(false);

  const selectedVideoId =
    preferredVideoId && videoDevices.some((d) => d.deviceId === preferredVideoId)
      ? preferredVideoId
      : (videoDevices[0]?.deviceId ?? null);
  const selectedAudioId =
    preferredAudioId && audioDevices.some((d) => d.deviceId === preferredAudioId)
      ? preferredAudioId
      : (audioDevices[0]?.deviceId ?? null);

  const refreshDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const vids = devices
        .filter((d) => d.kind === 'videoinput' && d.deviceId)
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
      const auds = devices
        .filter((d) => d.kind === 'audioinput' && d.deviceId)
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }));
      setVideoDevices(vids);
      setAudioDevices(auds);
      reconcileDevices({
        audioInputIds: new Set(auds.map((d) => d.deviceId)),
        videoInputIds: new Set(vids.map((d) => d.deviceId)),
        audioOutputIds: new Set(
          devices.filter((d) => d.kind === 'audiooutput' && d.deviceId).map((d) => d.deviceId),
        ),
      });
    } catch {
      // ignore; devices stay empty
    }
  }, [reconcileDevices]);

  useEffect(() => {
    void refreshDevices();
    const onChange = () => void refreshDevices();
    navigator.mediaDevices.addEventListener?.('devicechange', onChange);
    return () => {
      navigator.mediaDevices.removeEventListener?.('devicechange', onChange);
    };
  }, [refreshDevices]);

  const stopVideo = useCallback(() => {
    if (videoStreamRef.current) {
      for (const t of videoStreamRef.current.getTracks()) t.stop();
      videoStreamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const stopAudio = useCallback(() => {
    if (analyserRafRef.current !== null) {
      cancelAnimationFrame(analyserRafRef.current);
      analyserRafRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    if (audioStreamRef.current) {
      for (const t of audioStreamRef.current.getTracks()) t.stop();
      audioStreamRef.current = null;
    }
    prevBarRef.current = 0;
    setLevel(0);
  }, []);

  useEffect(() => {
    if (!cameraOn) {
      stopVideo();
      return;
    }
    const signal = { cancelled: false };
    setCameraError(null);
    const constraints: MediaStreamConstraints = selectedVideoId
      ? { video: { deviceId: { exact: selectedVideoId } } }
      : { video: true };
    void acquireStream(
      constraints,
      signal,
      (stream) => {
        videoStreamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setPermission('granted');
        if (!videoRefreshedRef.current) {
          videoRefreshedRef.current = true;
          void refreshDevices();
        }
      },
      (err) => {
        setCameraOn(false);
        const denied = err.name === 'NotAllowedError' || err.name === 'SecurityError';
        if (denied) setPermission('denied');
        setCameraError(
          denied ? t('lobbyPreview.cameraDenied') : t('lobbyPreview.cameraUnavailable'),
        );
      },
    );
    return () => {
      signal.cancelled = true;
      stopVideo();
    };
  }, [cameraOn, selectedVideoId, refreshDevices, stopVideo, t]);

  useEffect(() => {
    if (!micOn) {
      stopAudio();
      return;
    }
    const signal = { cancelled: false };
    setMicError(null);
    const baseAudio: MediaTrackConstraints = {
      noiseSuppression: audioProcessing.noiseSuppression,
      echoCancellation: audioProcessing.echoCancellation,
      autoGainControl: audioProcessing.autoGainControl,
    };
    if (selectedAudioId) baseAudio.deviceId = { exact: selectedAudioId };
    void acquireStream(
      { audio: baseAudio },
      signal,
      (stream) => {
        audioStreamRef.current = stream;
        setPermission('granted');
        if (!audioRefreshedRef.current) {
          audioRefreshedRef.current = true;
          void refreshDevices();
        }

        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        audioCtxRef.current = ctx;

        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (signal.cancelled) return;
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (const value of data) sum += value ?? 0;
          const avg = sum / data.length / 255;
          const next = Math.min(BAR_COUNT, Math.ceil(avg * BAR_COUNT));
          if (next !== prevBarRef.current) {
            prevBarRef.current = next;
            setLevel(next);
          }
          analyserRafRef.current = requestAnimationFrame(tick);
        };
        analyserRafRef.current = requestAnimationFrame(tick);
      },
      (err) => {
        setMicOn(false);
        const denied = err.name === 'NotAllowedError' || err.name === 'SecurityError';
        if (denied) setPermission('denied');
        setMicError(denied ? t('lobbyPreview.micDenied') : t('lobbyPreview.micUnavailable'));
      },
    );
    return () => {
      signal.cancelled = true;
      stopAudio();
    };
  }, [
    micOn,
    selectedAudioId,
    audioProcessing.noiseSuppression,
    audioProcessing.echoCancellation,
    audioProcessing.autoGainControl,
    refreshDevices,
    stopAudio,
    t,
  ]);

  useEffect(() => {
    return () => {
      stopVideo();
      stopAudio();
    };
  }, [stopVideo, stopAudio]);

  const handleToggleCamera = useCallback(() => {
    setCameraOn((v) => !v);
    if (permission === 'idle') setPermission('prompting');
  }, [permission]);

  const handleToggleMic = useCallback(() => {
    setMicOn((v) => !v);
    if (permission === 'idle') setPermission('prompting');
  }, [permission]);

  return (
    <section
      aria-label={t('lobbyPreview.title')}
      className="rounded-xl border border-border/60 bg-card/70 p-3 backdrop-blur"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {t('lobbyPreview.title')}
        </span>
        <button
          type="button"
          onClick={() => setShowDeviceRow((v) => !v)}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <Settings className="size-3" />
          {t('lobbyPreview.devices')}
        </button>
      </div>

      <div className="relative aspect-video overflow-hidden rounded-lg bg-black/80">
        {cameraOn ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full scale-x-[-1] object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <VideoOff className="size-6" />
            <span className="font-mono text-[10px]">{t('lobbyPreview.cameraOff')}</span>
          </div>
        )}
        {cameraError ? (
          <div className="absolute inset-x-0 bottom-0 bg-destructive/80 px-2 py-1 text-center text-[10px] text-destructive-foreground">
            {cameraError}
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        <div className="flex flex-1 items-center gap-0.5">
          {BAR_KEYS.map((key, i) => {
            const active = micOn && level > i;
            return (
              <div
                key={key}
                className={cn(
                  'h-2 flex-1 rounded-sm transition-colors duration-75',
                  active
                    ? i < BAR_COUNT * 0.6
                      ? 'bg-emerald-400'
                      : i < BAR_COUNT * 0.85
                        ? 'bg-amber-400'
                        : 'bg-destructive'
                    : 'bg-muted',
                )}
              />
            );
          })}
        </div>
        {micError ? (
          <span className="shrink-0 font-mono text-[10px] text-destructive">{micError}</span>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant={cameraOn ? 'default' : 'outline'}
          className="h-8 gap-1.5"
          onClick={handleToggleCamera}
        >
          {cameraOn ? <Video className="size-3.5" /> : <VideoOff className="size-3.5" />}
          {t(cameraOn ? 'lobbyPreview.cameraOnAction' : 'lobbyPreview.cameraOffAction')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={micOn ? 'default' : 'outline'}
          className="h-8 gap-1.5"
          onClick={handleToggleMic}
        >
          {micOn ? <Mic className="size-3.5" /> : <MicOff className="size-3.5" />}
          {t(micOn ? 'lobbyPreview.micOnAction' : 'lobbyPreview.micOffAction')}
        </Button>
        <div className="ml-auto flex items-center gap-1">
          <ToggleChip
            label={t('lobbyPreview.noiseSuppression')}
            icon={Shield}
            active={audioProcessing.noiseSuppression}
            onClick={() =>
              setAudioProcessing({
                ...audioProcessing,
                noiseSuppression: !audioProcessing.noiseSuppression,
              })
            }
          />
          <ToggleChip
            label={t('lobbyPreview.echoCancel')}
            icon={Sparkles}
            active={audioProcessing.echoCancellation}
            onClick={() =>
              setAudioProcessing({
                ...audioProcessing,
                echoCancellation: !audioProcessing.echoCancellation,
              })
            }
          />
        </div>
      </div>

      {showDeviceRow ? (
        <div className="mt-3 grid grid-cols-1 gap-2 border-t border-border/40 pt-3 sm:grid-cols-2">
          <DevicePicker
            icon={Video}
            label={t('lobbyPreview.camera')}
            devices={videoDevices}
            value={selectedVideoId}
            onChange={setPreferredVideoId}
            empty={t('lobbyPreview.noCameras')}
          />
          <DevicePicker
            icon={Mic}
            label={t('lobbyPreview.microphone')}
            devices={audioDevices}
            value={selectedAudioId}
            onChange={setPreferredAudioId}
            empty={t('lobbyPreview.noMicrophones')}
          />
        </div>
      ) : null}

      {permission === 'denied' ? (
        <p className="mt-3 text-[11px] text-muted-foreground">{t('lobbyPreview.permissionHelp')}</p>
      ) : null}
    </section>
  );
}

function DevicePicker({
  icon: Icon,
  label,
  devices,
  value,
  onChange,
  empty,
}: {
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly label: string;
  readonly devices: DeviceOption[];
  readonly value: string | null;
  readonly onChange: (id: string) => void;
  readonly empty: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5">
        <Icon className="size-3 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      {devices.length === 0 ? (
        <p className="font-mono text-[10px] text-muted-foreground/70">{empty}</p>
      ) : (
        <Select value={value ?? undefined} onValueChange={onChange}>
          <SelectTrigger className="h-7 text-[11px]">
            {devices.find((d) => d.deviceId === value)?.label ?? label}
          </SelectTrigger>
          <SelectContent>
            {devices.map((d) => (
              <SelectItem key={d.deviceId} value={d.deviceId} className="text-xs">
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

function ToggleChip({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  readonly label: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly active: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-colors',
        active
          ? 'border-primary/30 bg-primary/10 text-primary'
          : 'border-border/60 bg-transparent text-muted-foreground hover:bg-muted/50',
      )}
      aria-pressed={active}
      aria-label={label}
    >
      <Icon className="size-3" />
    </button>
  );
}
