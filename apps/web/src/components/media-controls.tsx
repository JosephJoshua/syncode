import { Button, cn } from '@syncode/ui';
import { Mic, MicOff, TriangleAlert, Video, VideoOff } from 'lucide-react';
import type { LiveKitConnectionState } from '@/hooks/use-livekit.js';

interface MediaControlsProps {
  connectionState: LiveKitConnectionState;
  isMicrophoneEnabled: boolean;
  isCameraEnabled: boolean;
  onToggleMicrophone: () => void;
  onToggleCamera: () => void;
}

export function MediaControls({
  connectionState,
  isMicrophoneEnabled,
  isCameraEnabled,
  onToggleMicrophone,
  onToggleCamera,
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

      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        disabled={!isConnected}
        className={cn(
          'size-6 rounded-md transition-all duration-150',
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

      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        disabled={!isConnected}
        className={cn(
          'size-6 rounded-md transition-all duration-150',
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
    </div>
  );
}
