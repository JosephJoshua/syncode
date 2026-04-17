import {
  Button,
  cn,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  Separator,
} from '@syncode/ui';
import { Mic, Settings, Shield, SlidersHorizontal, Sparkles, Video, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { MediaDeviceOption } from '@/hooks/use-livekit.js';

export interface AudioProcessingSettings {
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
}

interface MediaSettingsPanelProps {
  audioInputDevices: MediaDeviceOption[];
  videoInputDevices: MediaDeviceOption[];
  activeAudioDeviceId: string | null;
  activeVideoDeviceId: string | null;
  onSwitchDevice: (kind: MediaDeviceKind, deviceId: string) => void;
  outputVolume: number;
  onOutputVolumeChange: (volume: number) => void;
  audioProcessing: AudioProcessingSettings;
  onAudioProcessingChange: (settings: AudioProcessingSettings) => void;
  onVideoFilterChange: (settings: { brightness: number; contrast: number }) => void;
}

const LEVEL_BAR_COUNT = 16;
const LEVEL_BAR_KEYS = Array.from({ length: LEVEL_BAR_COUNT }, (_, i) => `bar-${String(i)}`);

function AudioLevelMeter({ deviceId }: { deviceId: string | null }) {
  const [level, setLevel] = useState(0);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!deviceId) return;

    let cancelled = false;
    let animFrame: number;

    navigator.mediaDevices
      .getUserMedia({ audio: { deviceId: { exact: deviceId } } })
      .then((stream) => {
        if (cancelled) {
          for (const t of stream.getTracks()) t.stop();
          return;
        }
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          if (cancelled) return;
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i] ?? 0;
          const avg = sum / data.length / 255;
          setLevel(avg);
          animFrame = requestAnimationFrame(tick);
        };
        tick();

        cleanupRef.current = () => {
          cancelled = true;
          cancelAnimationFrame(animFrame);
          source.disconnect();
          void ctx.close();
          for (const t of stream.getTracks()) t.stop();
        };
      })
      .catch(() => {
        setLevel(0);
      });

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
      setLevel(0);
    };
  }, [deviceId]);

  const bars = LEVEL_BAR_COUNT;

  return (
    <div className="flex items-center gap-0.5">
      {LEVEL_BAR_KEYS.map((key, i) => {
        const threshold = (i + 1) / bars;
        const active = level >= threshold;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: static bar count
          <div
            key={key}
            className={cn(
              'h-2.5 w-1 rounded-full transition-colors duration-75',
              active
                ? i < bars * 0.6
                  ? 'bg-emerald-400'
                  : i < bars * 0.85
                    ? 'bg-amber-400'
                    : 'bg-destructive'
                : 'bg-muted',
            )}
          />
        );
      })}
    </div>
  );
}

function VideoPreview({
  deviceId,
  brightness,
  contrast,
}: {
  deviceId: string | null;
  brightness: number;
  contrast: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!deviceId) return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    setError(false);

    navigator.mediaDevices
      .getUserMedia({ video: { deviceId: { exact: deviceId } } })
      .then((s) => {
        if (cancelled) {
          for (const t of s.getTracks()) t.stop();
          return;
        }
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
      if (videoRef.current) videoRef.current.srcObject = null;
      if (stream) for (const t of stream.getTracks()) t.stop();
    };
  }, [deviceId]);

  if (error) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-lg bg-muted/60">
        <span className="font-mono text-[10px] text-muted-foreground">Camera unavailable</span>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="aspect-video w-full rounded-lg bg-black/90 object-cover scale-x-[-1]"
      style={{ filter: `brightness(${brightness}) contrast(${contrast})` }}
    />
  );
}

function ToggleChip({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors',
        active
          ? 'border-primary/30 bg-primary/10 text-primary'
          : 'border-border/60 bg-transparent text-muted-foreground hover:bg-muted/50',
      )}
    >
      <Icon className="size-3" />
      {label}
    </button>
  );
}

export function MediaSettingsPanel({
  audioInputDevices,
  videoInputDevices,
  activeAudioDeviceId,
  activeVideoDeviceId,
  onSwitchDevice,
  outputVolume,
  onOutputVolumeChange,
  audioProcessing,
  onAudioProcessingChange,
  onVideoFilterChange,
}: MediaSettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const [brightness, setBrightness] = useState(1);
  const [contrast, setContrast] = useState(1);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="size-6 rounded-md text-muted-foreground/60 hover:text-foreground"
          aria-label="Media settings"
        >
          <Settings className="size-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-h-[80vh] overflow-y-auto p-0" sideOffset={8}>
        <div className="border-b border-border/40 px-3 py-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Media Settings
          </span>
        </div>

        <div className="space-y-1 p-1.5">
          {videoInputDevices.length > 0 ? (
            <div className="space-y-2 rounded-lg bg-muted/20 p-2.5">
              <div className="flex items-center gap-1.5">
                <Video className="size-3 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">Camera</span>
              </div>
              <VideoPreview
                deviceId={activeVideoDeviceId}
                brightness={brightness}
                contrast={contrast}
              />
              {videoInputDevices.length > 1 ? (
                <Select
                  value={activeVideoDeviceId ?? undefined}
                  onValueChange={(v) => onSwitchDevice('videoinput', v)}
                >
                  <SelectTrigger className="h-7 text-[11px]">
                    {videoInputDevices.find((d) => d.deviceId === activeVideoDeviceId)?.label ??
                      'Select camera'}
                  </SelectTrigger>
                  <SelectContent>
                    {videoInputDevices.map((d) => (
                      <SelectItem key={d.deviceId} value={d.deviceId} className="text-xs">
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] text-muted-foreground">Brightness</Label>
                  <span className="font-mono text-[10px] text-muted-foreground/60">
                    {Math.round(brightness * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.05"
                  value={brightness}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setBrightness(v);
                    onVideoFilterChange({ brightness: v, contrast });
                  }}
                  className="h-1 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] text-muted-foreground">Contrast</Label>
                  <span className="font-mono text-[10px] text-muted-foreground/60">
                    {Math.round(contrast * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.05"
                  value={contrast}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setContrast(v);
                    onVideoFilterChange({ brightness, contrast: v });
                  }}
                  className="h-1 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                />
              </div>

              {brightness !== 1 || contrast !== 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    setBrightness(1);
                    setContrast(1);
                    onVideoFilterChange({ brightness: 1, contrast: 1 });
                  }}
                  className="text-[10px] text-muted-foreground hover:text-foreground"
                >
                  Reset adjustments
                </button>
              ) : null}
            </div>
          ) : null}

          {audioInputDevices.length > 0 ? (
            <div className="space-y-2 rounded-lg bg-muted/20 p-2.5">
              <div className="flex items-center gap-1.5">
                <Mic className="size-3 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">Microphone</span>
              </div>

              <AudioLevelMeter deviceId={activeAudioDeviceId} />

              {audioInputDevices.length > 1 ? (
                <Select
                  value={activeAudioDeviceId ?? undefined}
                  onValueChange={(v) => onSwitchDevice('audioinput', v)}
                >
                  <SelectTrigger className="h-7 text-[11px]">
                    {audioInputDevices.find((d) => d.deviceId === activeAudioDeviceId)?.label ??
                      'Select microphone'}
                  </SelectTrigger>
                  <SelectContent>
                    {audioInputDevices.map((d) => (
                      <SelectItem key={d.deviceId} value={d.deviceId} className="text-xs">
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              <Separator className="my-1" />

              <div className="flex flex-wrap gap-1.5">
                <ToggleChip
                  label="Noise suppression"
                  icon={Shield}
                  active={audioProcessing.noiseSuppression}
                  onClick={() =>
                    onAudioProcessingChange({
                      ...audioProcessing,
                      noiseSuppression: !audioProcessing.noiseSuppression,
                    })
                  }
                />
                <ToggleChip
                  label="Echo cancel"
                  icon={Sparkles}
                  active={audioProcessing.echoCancellation}
                  onClick={() =>
                    onAudioProcessingChange({
                      ...audioProcessing,
                      echoCancellation: !audioProcessing.echoCancellation,
                    })
                  }
                />
                <ToggleChip
                  label="Auto gain"
                  icon={SlidersHorizontal}
                  active={audioProcessing.autoGainControl}
                  onClick={() =>
                    onAudioProcessingChange({
                      ...audioProcessing,
                      autoGainControl: !audioProcessing.autoGainControl,
                    })
                  }
                />
              </div>
            </div>
          ) : null}

          <div className="space-y-2 rounded-lg bg-muted/20 p-2.5">
            <div className="flex items-center gap-1.5">
              <Volume2 className="size-3 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">Speaker volume</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={outputVolume}
                onChange={(e) => onOutputVolumeChange(Number(e.target.value))}
                className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
              />
              <span className="w-8 text-right font-mono text-[10px] text-muted-foreground/60">
                {Math.round(outputVolume * 100)}%
              </span>
            </div>
          </div>

          {audioInputDevices.length === 0 && videoInputDevices.length === 0 ? (
            <p className="py-4 text-center font-mono text-xs text-muted-foreground">
              No media devices found
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
