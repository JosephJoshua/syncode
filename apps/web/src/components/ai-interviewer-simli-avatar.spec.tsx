import { CONTROL_API } from '@syncode/contracts';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiInterviewerSimliAvatar } from './ai-interviewer-simli-avatar.js';

const simliMocks = vi.hoisted(() => {
  return {
    api: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    clearBuffer: vi.fn(),
    listenToMediastreamTrack: vi.fn(),
    on: vi.fn(),
    constructor: vi.fn(),
    liveKitRoomConnect: vi.fn(),
    liveKitRoomDisconnect: vi.fn(),
    publishTrack: vi.fn(),
  };
});

vi.mock('@/lib/api-client.js', () => ({
  api: simliMocks.api,
}));

vi.mock('simli-client', () => ({
  LogLevel: { ERROR: 2 },
  SimliClient: simliMocks.constructor.mockImplementation(() => ({
    start: simliMocks.start,
    stop: simliMocks.stop,
    ClearBuffer: simliMocks.clearBuffer,
    listenToMediastreamTrack: simliMocks.listenToMediastreamTrack,
    on: simliMocks.on,
  })),
}));

vi.mock('livekit-client', () => ({
  Track: { Source: { Camera: 'camera' } },
  Room: vi.fn().mockImplementation(() => ({
    connect: simliMocks.liveKitRoomConnect,
    disconnect: simliMocks.liveKitRoomDisconnect,
    localParticipant: {
      publishTrack: simliMocks.publishTrack,
    },
  })),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('AiInterviewerSimliAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    simliMocks.api.mockReset();
    simliMocks.start.mockReset().mockResolvedValue(undefined);
    simliMocks.stop.mockReset().mockResolvedValue(undefined);
    simliMocks.clearBuffer.mockReset();
    simliMocks.listenToMediastreamTrack.mockReset();
    simliMocks.on.mockReset();
    simliMocks.constructor.mockClear();
    simliMocks.liveKitRoomConnect.mockReset().mockResolvedValue(undefined);
    simliMocks.liveKitRoomDisconnect.mockReset();
    simliMocks.publishTrack.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('GIVEN Simli is enabled and AI audio is available WHEN rendered THEN starts a hidden LiveKit avatar video publisher', async () => {
    const audioTrack = { id: 'track-1' } as MediaStreamTrack;
    const speechGate = installSpeechGateMock();
    simliMocks.api.mockResolvedValue({
      enabled: true,
      sessionToken: 'simli-session-token',
      wsUrl: 'wss://api.simli.ai',
      audioBufferSize: 4096,
      liveKitToken: 'avatar-livekit-token',
      liveKitUrl: 'ws://localhost:7880',
      avatarIdentity: 'ai-interviewer-avatar',
    });
    const avatarVideoTrack = { id: 'avatar-video-track' } as MediaStreamTrack;
    mockVideoElementReady();
    mockCanvasPublisher(avatarVideoTrack);

    render(
      <AiInterviewerSimliAvatar
        roomId="room-1"
        enabled
        audioTrack={audioTrack}
        isSpeaking={false}
      />,
    );

    await waitFor(() => {
      expect(simliMocks.listenToMediastreamTrack).toHaveBeenCalledWith(speechGate.gatedTrack);
    });
    expect(simliMocks.api).toHaveBeenCalledWith(
      CONTROL_API.ROOMS.AI_INTERVIEW_SIMLI_AVATAR_SESSION,
      { params: { id: 'room-1' } },
    );
    expect(simliMocks.constructor).toHaveBeenCalledWith(
      'simli-session-token',
      expect.any(HTMLVideoElement),
      expect.any(HTMLAudioElement),
      null,
      2,
      'livekit',
      'websockets',
      'wss://api.simli.ai',
      4096,
    );
    expect(screen.queryByText('workspace.simliAvatarConnected')).not.toBeInTheDocument();
    expect(screen.getByTestId('simli-avatar-publisher')).toHaveAttribute('aria-hidden', 'true');
    const simliAudioElement = screen.getByTestId('simli-avatar-audio') as HTMLAudioElement;
    expect(simliAudioElement.muted).toBe(true);
    expect(simliAudioElement.volume).toBe(0);
    expect(speechGate.setTargetAtTime).toHaveBeenCalledWith(0, 0, 0.035);
    expect(simliMocks.liveKitRoomConnect).toHaveBeenCalledWith(
      'ws://localhost:7880',
      'avatar-livekit-token',
      expect.objectContaining({ autoSubscribe: false }),
    );
    expect(simliMocks.publishTrack).toHaveBeenCalledWith(
      avatarVideoTrack,
      expect.objectContaining({
        name: 'ai-interviewer-avatar-video',
        source: 'camera',
        simulcast: false,
        videoEncoding: expect.objectContaining({
          maxBitrate: 6_000_000,
          maxFramerate: 30,
        }),
      }),
    );
  });

  it('GIVEN Simli is running WHEN AI interviewer speaking changes THEN gates avatar lip-sync input', async () => {
    const audioTrack = { id: 'track-1' } as MediaStreamTrack;
    const speechGate = installSpeechGateMock();
    simliMocks.api.mockResolvedValue({
      enabled: true,
      sessionToken: 'simli-session-token',
      wsUrl: 'wss://api.simli.ai',
      audioBufferSize: 4096,
      liveKitToken: 'avatar-livekit-token',
      liveKitUrl: 'ws://localhost:7880',
      avatarIdentity: 'ai-interviewer-avatar',
    });
    mockVideoElementReady();
    mockCanvasPublisher({ id: 'avatar-video-track' } as MediaStreamTrack);

    const { rerender } = render(
      <AiInterviewerSimliAvatar roomId="room-1" enabled audioTrack={audioTrack} isSpeaking />,
    );

    await waitFor(() => {
      expect(simliMocks.listenToMediastreamTrack).toHaveBeenCalledWith(speechGate.gatedTrack);
    });
    expect(speechGate.setTargetAtTime).toHaveBeenCalledWith(1, 0, 0.035);

    rerender(
      <AiInterviewerSimliAvatar
        roomId="room-1"
        enabled
        audioTrack={audioTrack}
        isSpeaking={false}
      />,
    );

    await waitFor(() => {
      expect(speechGate.setTargetAtTime).toHaveBeenCalledWith(0, 0, 0.035);
    });
    expect(simliMocks.clearBuffer).toHaveBeenCalled();
  });

  it('GIVEN Simli is not configured WHEN rendered THEN does not construct the Simli client', async () => {
    const audioTrack = { id: 'track-1' } as MediaStreamTrack;
    simliMocks.api.mockResolvedValue({ enabled: false });

    render(<AiInterviewerSimliAvatar roomId="room-1" enabled audioTrack={audioTrack} />);

    await waitFor(() => {
      expect(simliMocks.api).toHaveBeenCalled();
    });
    expect(simliMocks.constructor).not.toHaveBeenCalled();
  });

  it('GIVEN no AI audio track WHEN rendered THEN waits without calling the token endpoint', () => {
    render(<AiInterviewerSimliAvatar roomId="room-1" enabled audioTrack={null} />);

    expect(screen.getByTestId('simli-avatar-publisher')).toBeInTheDocument();
    expect(simliMocks.api).not.toHaveBeenCalled();
  });
});

function mockVideoElementReady() {
  Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
    configurable: true,
    get: () => HTMLMediaElement.HAVE_CURRENT_DATA,
  });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
    configurable: true,
    get: () => 1920,
  });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
    configurable: true,
    get: () => 1080,
  });
}

function mockCanvasPublisher(avatarVideoTrack: MediaStreamTrack) {
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: vi.fn().mockReturnValue({
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
    }),
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'captureStream', {
    configurable: true,
    value: vi.fn().mockReturnValue({
      getVideoTracks: () => [avatarVideoTrack],
    } as unknown as MediaStream),
  });
}

function installSpeechGateMock() {
  const gatedTrack = {
    id: 'gated-avatar-audio-track',
    stop: vi.fn(),
  } as unknown as MediaStreamTrack;
  const setTargetAtTime = vi.fn();
  const gainNode = {
    connect: vi.fn(),
    gain: {
      value: 0,
      setTargetAtTime,
    },
  };
  const sourceNode = { connect: vi.fn() };
  const destination = {
    stream: {
      getAudioTracks: () => [gatedTrack],
    },
  };
  const audioContext = {
    close: vi.fn().mockResolvedValue(undefined),
    createGain: vi.fn(() => gainNode),
    createMediaStreamDestination: vi.fn(() => destination),
    createMediaStreamSource: vi.fn(() => sourceNode),
    currentTime: 0,
  };
  vi.stubGlobal(
    'AudioContext',
    vi.fn(() => audioContext),
  );
  vi.stubGlobal(
    'MediaStream',
    vi.fn((tracks: MediaStreamTrack[] = []) => ({
      getAudioTracks: () => tracks,
    })),
  );

  return { gatedTrack, setTargetAtTime };
}
