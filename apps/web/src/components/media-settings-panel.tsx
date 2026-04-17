import {
  Button,
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@syncode/ui';
import { Mic, Settings, Video } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { MediaDeviceOption } from '@/hooks/use-livekit.js';

interface MediaSettingsPanelProps {
  audioInputDevices: MediaDeviceOption[];
  videoInputDevices: MediaDeviceOption[];
  activeAudioDeviceId: string | null;
  activeVideoDeviceId: string | null;
  onSwitchDevice: (kind: MediaDeviceKind, deviceId: string) => void;
}

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
          ctx.close();
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

  const bars = 12;
  const barKeys = Array.from({ length: bars }, (_, i) => `bar-${String(i)}`);

  return (
    <div className="flex items-center gap-0.5">
      <Mic className="mr-1 size-3 shrink-0 text-muted-foreground" />
      {barKeys.map((key, i) => {
        const threshold = (i + 1) / bars;
        const active = level >= threshold;
        return (
          <div
            key={key}
            className={cn(
              'h-3 w-1 rounded-full transition-colors duration-75',
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

function VideoPreview({ deviceId }: { deviceId: string | null }) {
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
    />
  );
}

export function MediaSettingsPanel({
  audioInputDevices,
  videoInputDevices,
  activeAudioDeviceId,
  activeVideoDeviceId,
  onSwitchDevice,
}: MediaSettingsPanelProps) {
  const [open, setOpen] = useState(false);

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
      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        <div className="border-b border-border/40 px-3 py-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Media Settings
          </span>
        </div>

        <div className="space-y-3 p-3">
          {videoInputDevices.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Video className="size-3 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">Camera</span>
              </div>
              <VideoPreview deviceId={activeVideoDeviceId} />
              {videoInputDevices.length > 1 ? (
                <Select
                  value={activeVideoDeviceId ?? undefined}
                  onValueChange={(v) => onSwitchDevice('videoinput', v)}
                >
                  <SelectTrigger className="h-8 text-xs">
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
            </div>
          ) : null}

          {audioInputDevices.length > 0 ? (
            <div className="space-y-2">
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
                  <SelectTrigger className="h-8 text-xs">
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
            </div>
          ) : null}

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
