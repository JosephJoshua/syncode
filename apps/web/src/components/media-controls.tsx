import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@syncode/ui';
import {
  Check,
  ChevronDown,
  Mic,
  MicOff,
  MonitorUp,
  TriangleAlert,
  Video,
  VideoOff,
} from 'lucide-react';
import type { LiveKitConnectionState, MediaDeviceOption } from '@/hooks/use-livekit.js';
import type { VideoFilterSettings } from '@/lib/video-filter-processor.js';
import { type AudioProcessingSettings, MediaSettingsPanel } from './media-settings-panel.js';

interface MediaControlsProps {
  connectionState: LiveKitConnectionState;
  isMicrophoneEnabled: boolean;
  isCameraEnabled: boolean;
  isScreenShareEnabled: boolean;
  canScreenShare: boolean;
  onToggleMicrophone: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  audioInputDevices: MediaDeviceOption[];
  videoInputDevices: MediaDeviceOption[];
  activeAudioDeviceId: string | null;
  activeVideoDeviceId: string | null;
  onSwitchDevice: (kind: MediaDeviceKind, deviceId: string) => void;
  outputVolume: number;
  onOutputVolumeChange: (volume: number) => void;
  audioProcessing: AudioProcessingSettings;
  onAudioProcessingChange: (settings: AudioProcessingSettings) => void;
  onVideoFilterChange: (settings: VideoFilterSettings) => void;
  videoQuality: import('./media-settings-panel.js').VideoQualityPreset;
  onVideoQualityChange: (quality: import('./media-settings-panel.js').VideoQualityPreset) => void;
  isPushToTalkMode: boolean;
  onTogglePushToTalkMode: () => void;
}

export function MediaControls({
  connectionState,
  isMicrophoneEnabled,
  isCameraEnabled,
  isScreenShareEnabled,
  canScreenShare,
  onToggleMicrophone,
  onToggleCamera,
  onToggleScreenShare,
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
  videoQuality,
  onVideoQualityChange,
  isPushToTalkMode,
  onTogglePushToTalkMode,
}: MediaControlsProps) {
  const isConnected = connectionState === 'connected';
  const isConnecting = connectionState === 'connecting' || connectionState === 'reconnecting';
  const isFailed = connectionState === 'failed';

  if (isFailed) {
    return (
      <div className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-2 py-1">
        <TriangleAlert className="size-3 text-destructive" />
        <span className="font-mono text-[10px] text-destructive">media offline</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-px rounded-lg border border-border/40 bg-muted/30 p-0.5">
      {isConnecting ? (
        <span className="flex items-center gap-1 px-1.5">
          <span className="size-1.5 animate-pulse rounded-full bg-amber-400" />
        </span>
      ) : null}

      <div className="flex items-center">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          disabled={!isConnected}
          className={cn(
            'size-6 rounded-md rounded-r-none transition-all duration-150',
            isConnected &&
              !isMicrophoneEnabled &&
              'bg-destructive/15 text-destructive hover:bg-destructive/25',
            isConnected &&
              isMicrophoneEnabled &&
              'text-foreground/80 hover:bg-background/80 hover:text-foreground',
            !isConnected && 'text-muted-foreground/40',
          )}
          onClick={onToggleMicrophone}
          aria-label={isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'}
        >
          {isMicrophoneEnabled ? <Mic className="size-3" /> : <MicOff className="size-3" />}
        </Button>
        {isConnected && audioInputDevices.length > 1 ? (
          <DeviceDropdown
            devices={audioInputDevices}
            activeDeviceId={activeAudioDeviceId}
            onSelect={(id) => onSwitchDevice('audioinput', id)}
          />
        ) : null}
      </div>

      <div className="mx-px h-3 w-px bg-border/40" />

      <div className="flex items-center">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          disabled={!isConnected}
          className={cn(
            'size-6 rounded-md rounded-r-none transition-all duration-150',
            isConnected && isCameraEnabled && 'bg-primary/15 text-primary hover:bg-primary/25',
            isConnected &&
              !isCameraEnabled &&
              'text-foreground/80 hover:bg-background/80 hover:text-foreground',
            !isConnected && 'text-muted-foreground/40',
          )}
          onClick={onToggleCamera}
          aria-label={isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          {isCameraEnabled ? <Video className="size-3" /> : <VideoOff className="size-3" />}
        </Button>
        {isConnected && videoInputDevices.length > 1 ? (
          <DeviceDropdown
            devices={videoInputDevices}
            activeDeviceId={activeVideoDeviceId}
            onSelect={(id) => onSwitchDevice('videoinput', id)}
          />
        ) : null}
      </div>

      {isConnected && canScreenShare ? (
        <>
          <div className="mx-px h-3 w-px bg-border/40" />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className={cn(
              'size-6 rounded-md transition-all duration-150',
              isScreenShareEnabled
                ? 'bg-primary/15 text-primary hover:bg-primary/25'
                : 'text-foreground/80 hover:bg-background/80 hover:text-foreground',
            )}
            onClick={onToggleScreenShare}
            aria-label={isScreenShareEnabled ? 'Stop sharing screen' : 'Share screen'}
          >
            <MonitorUp className="size-3" />
          </Button>
        </>
      ) : null}

      {isConnected ? (
        <>
          <div className="mx-px h-3 w-px bg-border/40" />
          <MediaSettingsPanel
            audioInputDevices={audioInputDevices}
            videoInputDevices={videoInputDevices}
            activeAudioDeviceId={activeAudioDeviceId}
            activeVideoDeviceId={activeVideoDeviceId}
            onSwitchDevice={onSwitchDevice}
            outputVolume={outputVolume}
            onOutputVolumeChange={onOutputVolumeChange}
            audioProcessing={audioProcessing}
            onAudioProcessingChange={onAudioProcessingChange}
            onVideoFilterChange={onVideoFilterChange}
            videoQuality={videoQuality}
            onVideoQualityChange={onVideoQualityChange}
            isPushToTalkMode={isPushToTalkMode}
            onTogglePushToTalkMode={onTogglePushToTalkMode}
          />
        </>
      ) : null}
    </div>
  );
}

function DeviceDropdown({
  devices,
  activeDeviceId,
  onSelect,
}: {
  devices: MediaDeviceOption[];
  activeDeviceId: string | null;
  onSelect: (deviceId: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="size-6 rounded-md rounded-l-none px-0.5 text-muted-foreground/60 hover:text-foreground"
        >
          <ChevronDown className="size-2.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-w-64">
        {devices.map((device) => (
          <DropdownMenuItem
            key={device.deviceId}
            onSelect={() => onSelect(device.deviceId)}
            className="gap-2 text-xs"
          >
            {device.deviceId === activeDeviceId ? (
              <Check className="size-3 shrink-0 text-primary" />
            ) : (
              <span className="size-3 shrink-0" />
            )}
            <span className="truncate">{device.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
