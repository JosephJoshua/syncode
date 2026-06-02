import { CONTROL_API } from '@syncode/contracts';
import { Room, Track } from 'livekit-client';
import { useEffect, useRef } from 'react';
import { api } from '@/lib/api-client.js';

type SimliClientInstance = InstanceType<typeof import('simli-client')['SimliClient']>;

const AVATAR_VIDEO_TRACK_NAME = 'ai-interviewer-avatar-video';
const AVATAR_VIDEO_CAPTURE_TIMEOUT_MS = 5000;
const AVATAR_VIDEO_CAPTURE_POLL_MS = 100;
const AVATAR_VIDEO_WIDTH = 1920;
const AVATAR_VIDEO_HEIGHT = 1080;
const AVATAR_START_ATTEMPTS = 3;
const AVATAR_START_RETRY_DELAY_MS = 1500;
const AVATAR_VIDEO_MAX_BITRATE = 6_000_000;
const AVATAR_VIDEO_MAX_FRAMERATE = 30;

interface SpeechGatedAudioTrack {
  track: MediaStreamTrack;
  setSpeaking: (speaking: boolean) => void;
  cleanup: () => void;
}

interface PublishedAvatarVideo {
  room: Room;
  cleanup: () => void;
}

interface AiInterviewerSimliAvatarProps {
  roomId: string;
  audioTrack: MediaStreamTrack | null;
  enabled: boolean;
  isSpeaking?: boolean;
}

export function AiInterviewerSimliAvatar({
  roomId,
  audioTrack,
  enabled,
  isSpeaking = false,
}: AiInterviewerSimliAvatarProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const clientRef = useRef<SimliClientInstance | null>(null);
  const speechGateRef = useRef<SpeechGatedAudioTrack | null>(null);
  const isSpeakingRef = useRef(isSpeaking);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
    speechGateRef.current?.setSpeaking(isSpeaking);
    if (!isSpeaking) {
      clearSimliBuffer(clientRef.current);
    }
  }, [isSpeaking]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (!audioTrack) {
      return;
    }

    const activeAudioTrack = audioTrack;
    const activeVideoElement = videoRef.current;
    const activeAudioElement = audioRef.current;
    const activeCanvasElement = canvasRef.current;
    if (!activeVideoElement || !activeAudioElement || !activeCanvasElement) {
      return;
    }
    const simliAudioTrack: MediaStreamTrack = activeAudioTrack;
    const simliVideoElement: HTMLVideoElement = activeVideoElement;
    const simliAudioElement: HTMLAudioElement = activeAudioElement;
    const simliCanvasElement: HTMLCanvasElement = activeCanvasElement;
    const keepSimliAudioSilent = () => silenceAudioElement(simliAudioElement);
    keepSimliAudioSilent();
    simliAudioElement.addEventListener('volumechange', keepSimliAudioSilent);

    let disposed = false;
    let client: SimliClientInstance | null = null;
    let avatarVideo: PublishedAvatarVideo | null = null;
    let speechGate: SpeechGatedAudioTrack | null = null;

    async function startAvatar() {
      for (let attempt = 1; attempt <= AVATAR_START_ATTEMPTS && !disposed; attempt += 1) {
        try {
          await startAvatarOnce();
          return;
        } catch (error) {
          console.warn(
            `[Simli] Failed to start AI interviewer avatar (attempt ${attempt}/${AVATAR_START_ATTEMPTS}):`,
            error,
          );
          await cleanupAttempt();
          if (attempt < AVATAR_START_ATTEMPTS && !disposed) {
            await sleep(AVATAR_START_RETRY_DELAY_MS * attempt);
          }
        }
      }
    }

    async function cleanupAttempt() {
      const failedClient = client;
      if (failedClient) {
        clearSimliBuffer(failedClient);
        await stopSimliClient(failedClient);
      }
      if (clientRef.current === failedClient) {
        clientRef.current = null;
      }
      client = null;
      if (speechGateRef.current === speechGate) {
        speechGateRef.current = null;
      }
      speechGate?.cleanup();
      speechGate = null;
      avatarVideo?.cleanup();
      avatarVideo?.room.disconnect();
      avatarVideo = null;
    }

    async function startAvatarOnce() {
      client = null;
      speechGate = null;
      avatarVideo = null;

      const session = await api(CONTROL_API.ROOMS.AI_INTERVIEW_SIMLI_AVATAR_SESSION, {
        params: { id: roomId },
      });
      if (disposed) return;
      if (!session.enabled) {
        return;
      }

      const { LogLevel, SimliClient } = await import('simli-client');
      if (disposed) return;

      client = new SimliClient(
        session.sessionToken,
        simliVideoElement,
        simliAudioElement,
        null,
        LogLevel.ERROR,
        'livekit',
        'websockets',
        session.wsUrl,
        session.audioBufferSize,
      );
      clientRef.current = client;
      client.on('error', () => console.warn('[Simli] AI interviewer avatar client error'));
      client.on('startup_error', () => console.warn('[Simli] AI interviewer avatar startup error'));
      await client.start();
      keepSimliAudioSilent();
      if (disposed) {
        await client.stop();
        return;
      }

      speechGate = createSpeechGatedAudioTrack(simliAudioTrack, isSpeakingRef.current);
      speechGateRef.current = speechGate;
      client.listenToMediastreamTrack(speechGate.track);
      avatarVideo = await publishAvatarVideoToLiveKit({
        canvasElement: simliCanvasElement,
        sourceVideoElement: simliVideoElement,
        token: session.liveKitToken,
        url: session.liveKitUrl,
      });
      if (disposed) {
        avatarVideo.cleanup();
        avatarVideo.room.disconnect();
        return;
      }
    }

    void startAvatar();

    return () => {
      disposed = true;
      simliAudioElement.removeEventListener('volumechange', keepSimliAudioSilent);
      if (client) {
        clearSimliBuffer(client);
        void stopSimliClient(client);
      }
      if (clientRef.current === client) {
        clientRef.current = null;
      }
      if (speechGateRef.current === speechGate) {
        speechGateRef.current = null;
      }
      speechGate?.cleanup();
      avatarVideo?.cleanup();
      avatarVideo?.room.disconnect();
    };
  }, [audioTrack, enabled, roomId]);

  if (!enabled) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 h-[1080px] w-[1920px] origin-top-left scale-[0.001] overflow-hidden opacity-[0.01]"
      data-testid="simli-avatar-publisher"
    >
      <video
        ref={videoRef}
        className="h-[1080px] w-[1920px] object-contain"
        autoPlay
        disablePictureInPicture
        height={AVATAR_VIDEO_HEIGHT}
        muted
        playsInline
        preload="auto"
        width={AVATAR_VIDEO_WIDTH}
        data-testid="simli-avatar-video"
      />
      <canvas
        ref={canvasRef}
        className="h-[1080px] w-[1920px]"
        height={AVATAR_VIDEO_HEIGHT}
        width={AVATAR_VIDEO_WIDTH}
        data-testid="simli-avatar-canvas"
      />
      <audio ref={audioRef} autoPlay muted data-testid="simli-avatar-audio" />
    </div>
  );
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, delayMs));
}

function clearSimliBuffer(client: SimliClientInstance | null): void {
  try {
    client?.ClearBuffer();
  } catch (error) {
    console.warn('[Simli] Failed to clear avatar buffer:', error);
  }
}

async function stopSimliClient(client: SimliClientInstance): Promise<void> {
  try {
    await client.stop();
  } catch (error) {
    console.warn('[Simli] Failed to stop avatar client:', error);
  }
}

function silenceAudioElement(audioElement: HTMLAudioElement): void {
  audioElement.defaultMuted = true;
  audioElement.muted = true;
  audioElement.volume = 0;
  audioElement.setAttribute('muted', '');
}

function createSpeechGatedAudioTrack(
  sourceTrack: MediaStreamTrack,
  initiallySpeaking: boolean,
): SpeechGatedAudioTrack {
  try {
    const AudioContextConstructor =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) {
      return createPassthroughSpeechGate(sourceTrack);
    }

    const audioContext = new AudioContextConstructor();
    const source = audioContext.createMediaStreamSource(new MediaStream([sourceTrack]));
    const gain = audioContext.createGain();
    const destination = audioContext.createMediaStreamDestination();

    source.connect(gain);
    gain.connect(destination);

    const [track] = destination.stream.getAudioTracks();
    if (!track) {
      void audioContext.close().catch(() => undefined);
      return createPassthroughSpeechGate(sourceTrack);
    }

    const setSpeaking = (speaking: boolean) => {
      const targetGain = speaking ? 1 : 0;
      if (typeof gain.gain.setTargetAtTime === 'function') {
        gain.gain.setTargetAtTime(targetGain, audioContext.currentTime, 0.035);
      } else {
        gain.gain.value = targetGain;
      }
    };
    setSpeaking(initiallySpeaking);

    return {
      track,
      setSpeaking,
      cleanup: () => {
        track.stop();
        void audioContext.close().catch(() => undefined);
      },
    };
  } catch (error) {
    console.warn('[Simli] Speech-gated avatar audio unavailable; using raw AI audio track:', error);
    return createPassthroughSpeechGate(sourceTrack);
  }
}

function createPassthroughSpeechGate(sourceTrack: MediaStreamTrack): SpeechGatedAudioTrack {
  return {
    track: sourceTrack,
    setSpeaking: () => undefined,
    cleanup: () => undefined,
  };
}

async function publishAvatarVideoToLiveKit({
  canvasElement,
  sourceVideoElement,
  token,
  url,
}: {
  canvasElement: HTMLCanvasElement;
  sourceVideoElement: HTMLVideoElement;
  token: string;
  url: string;
}): Promise<PublishedAvatarVideo> {
  const stopRendering = startAvatarCanvasRenderer({
    canvasElement,
    sourceVideoElement,
  });
  const stream = captureCanvasStream(canvasElement);
  const videoTrack = await waitForCapturedVideoTrack(stream);
  const room = new Room();
  try {
    await room.connect(url, token, { autoSubscribe: false });
    await room.localParticipant.publishTrack(videoTrack, {
      name: AVATAR_VIDEO_TRACK_NAME,
      source: Track.Source.Camera,
      simulcast: false,
      videoEncoding: {
        maxBitrate: AVATAR_VIDEO_MAX_BITRATE,
        maxFramerate: AVATAR_VIDEO_MAX_FRAMERATE,
      },
    });
    console.debug('[Simli] Published AI interviewer avatar canvas video to LiveKit');
    return {
      room,
      cleanup: stopRendering,
    };
  } catch (error) {
    stopRendering();
    room.disconnect();
    throw error;
  }
}

function startAvatarCanvasRenderer({
  canvasElement,
  sourceVideoElement,
}: {
  canvasElement: HTMLCanvasElement;
  sourceVideoElement: HTMLVideoElement;
}): () => void {
  canvasElement.width = AVATAR_VIDEO_WIDTH;
  canvasElement.height = AVATAR_VIDEO_HEIGHT;
  const context = canvasElement.getContext('2d');
  if (!context) {
    return () => undefined;
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';

  let animationFrame: number | null = null;
  let stopped = false;
  const renderFrame = () => {
    if (stopped) {
      return;
    }

    context.fillStyle = '#020617';
    context.fillRect(0, 0, AVATAR_VIDEO_WIDTH, AVATAR_VIDEO_HEIGHT);
    if (
      sourceVideoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      sourceVideoElement.videoWidth > 0 &&
      sourceVideoElement.videoHeight > 0
    ) {
      try {
        drawContainedVideoFrame(context, sourceVideoElement);
      } catch (error) {
        console.warn('[Simli] Failed to draw AI interviewer avatar frame:', error);
      }
    }

    animationFrame = window.requestAnimationFrame(renderFrame);
  };
  renderFrame();

  return () => {
    stopped = true;
    if (animationFrame !== null) {
      window.cancelAnimationFrame(animationFrame);
    }
  };
}

function drawContainedVideoFrame(
  context: CanvasRenderingContext2D,
  sourceVideoElement: HTMLVideoElement,
): void {
  const sourceWidth = sourceVideoElement.videoWidth;
  const sourceHeight = sourceVideoElement.videoHeight;
  const scale = Math.min(AVATAR_VIDEO_WIDTH / sourceWidth, AVATAR_VIDEO_HEIGHT / sourceHeight);
  const width = Math.round(sourceWidth * scale);
  const height = Math.round(sourceHeight * scale);
  const x = Math.round((AVATAR_VIDEO_WIDTH - width) / 2);
  const y = Math.round((AVATAR_VIDEO_HEIGHT - height) / 2);
  context.drawImage(sourceVideoElement, x, y, width, height);
}

function captureCanvasStream(canvasElement: HTMLCanvasElement): MediaStream {
  const capturableCanvasElement = canvasElement as HTMLCanvasElement & {
    captureStream?: (frameRate?: number) => MediaStream;
    mozCaptureStream?: (frameRate?: number) => MediaStream;
  };
  const captureStream =
    capturableCanvasElement.captureStream ?? capturableCanvasElement.mozCaptureStream;
  if (!captureStream) {
    throw new Error('Browser does not support canvas captureStream for Simli avatar publishing');
  }

  return captureStream.call(canvasElement, AVATAR_VIDEO_MAX_FRAMERATE);
}

async function waitForCapturedVideoTrack(stream: MediaStream): Promise<MediaStreamTrack> {
  const expiresAt = Date.now() + AVATAR_VIDEO_CAPTURE_TIMEOUT_MS;
  while (Date.now() < expiresAt) {
    const [track] = stream.getVideoTracks();
    if (track) {
      return track;
    }
    await new Promise((resolve) => setTimeout(resolve, AVATAR_VIDEO_CAPTURE_POLL_MS));
  }

  throw new Error('Timed out waiting for Simli avatar video track');
}
