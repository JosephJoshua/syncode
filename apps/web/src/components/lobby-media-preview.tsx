import { cn } from '@syncode/ui';
import { Mic, MicOff, MonitorUp, VideoOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useVideoTrack } from '@/hooks/use-video-track.js';

interface LobbyMediaPreviewProps {
  readonly videoTrack: MediaStreamTrack | null;
  readonly hasVideo: boolean;
  readonly isCameraEnabled: boolean;
  readonly screenShareTrack: MediaStreamTrack | null;
  readonly hasScreenShare: boolean;
  readonly isScreenShareEnabled: boolean;
  readonly isMicrophoneEnabled: boolean;
  readonly isSpeaking: boolean;
  readonly mediaControls: ReactNode | null;
}

function CameraVideo({ track, className }: { track: MediaStreamTrack; className?: string }) {
  const videoRef = useVideoTrack(track);
  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className={cn('h-full w-full scale-x-[-1] object-cover', className)}
    />
  );
}

function ScreenShareVideo({ track }: { track: MediaStreamTrack }) {
  const videoRef = useVideoTrack(track);
  return (
    <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-contain" />
  );
}

export function LobbyMediaPreview({
  videoTrack,
  hasVideo,
  isCameraEnabled,
  screenShareTrack,
  hasScreenShare,
  isScreenShareEnabled,
  isMicrophoneEnabled,
  isSpeaking,
  mediaControls,
}: LobbyMediaPreviewProps) {
  const { t } = useTranslation('rooms');

  const showCamera = hasVideo && !!videoTrack;
  const showScreenShare = hasScreenShare && !!screenShareTrack;
  const showCameraStartingHint = isCameraEnabled && !showCamera && !showScreenShare;
  const showScreenShareStartingHint = isScreenShareEnabled && !showScreenShare;

  const placeholderLabel = (() => {
    if (showScreenShareStartingHint) return t('lobbyPreview.screenShareStarting');
    if (showCameraStartingHint) return t('lobbyPreview.cameraStarting');
    return t('lobbyPreview.cameraOff');
  })();

  return (
    <section
      aria-label={t('lobbyPreview.title')}
      className="rounded-xl border border-border/60 bg-card/70 p-3 backdrop-blur"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {t('lobbyPreview.title')}
        </span>
        {mediaControls}
      </div>

      <div className="relative aspect-video overflow-hidden rounded-lg bg-black/80">
        {showScreenShare ? (
          <>
            <ScreenShareVideo track={screenShareTrack} />
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white/90 backdrop-blur-sm">
              <MonitorUp className="size-3" />
              {t('lobbyPreview.screenShareLabel')}
            </span>
            {showCamera ? (
              <div className="absolute bottom-2 right-2 aspect-video w-1/4 min-w-[88px] overflow-hidden rounded-md ring-2 ring-background/80 shadow-lg">
                <CameraVideo track={videoTrack} />
              </div>
            ) : null}
          </>
        ) : showCamera ? (
          <CameraVideo track={videoTrack} />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
            {showScreenShareStartingHint ? (
              <MonitorUp className="size-6" />
            ) : (
              <VideoOff className="size-6" />
            )}
            <span className="font-mono text-[10px]">{placeholderLabel}</span>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span
          className={cn(
            'inline-flex size-6 items-center justify-center rounded-md transition-colors',
            isMicrophoneEnabled
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-muted/40 text-muted-foreground/70',
          )}
        >
          {isMicrophoneEnabled ? <Mic className="size-3" /> : <MicOff className="size-3" />}
        </span>
        <div
          aria-hidden
          className={cn(
            'h-1.5 flex-1 rounded-full transition-colors duration-150',
            isMicrophoneEnabled
              ? isSpeaking
                ? 'bg-emerald-400 shadow-[0_0_10px_-2px_oklch(0.75_0.18_155/0.7)]'
                : 'bg-emerald-500/20'
              : 'bg-muted/40',
          )}
        />
        <span className="font-mono text-[10px] text-muted-foreground">
          {isMicrophoneEnabled
            ? isSpeaking
              ? t('lobbyPreview.micSpeaking')
              : t('lobbyPreview.micQuiet')
            : t('lobbyPreview.micOff')}
        </span>
      </div>
    </section>
  );
}
