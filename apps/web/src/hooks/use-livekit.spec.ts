import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type UseLiveKitOptions, useLiveKit } from './use-livekit.js';

// ---------------------------------------------------------------------------
// Hoisted mock room reference — accessible in vi.mock factory
// ---------------------------------------------------------------------------

type EventHandler = (...args: unknown[]) => void;

interface IMockRoom {
  handlers: Map<string, EventHandler[]>;
  localParticipant: {
    identity: string;
    isMicrophoneEnabled: boolean;
    isCameraEnabled: boolean;
    isScreenShareEnabled: boolean;
    activeDeviceMap: Map<string, string>;
    getTrackPublication: ReturnType<typeof vi.fn>;
    setMicrophoneEnabled: ReturnType<typeof vi.fn>;
    setCameraEnabled: ReturnType<typeof vi.fn>;
    setScreenShareEnabled: ReturnType<typeof vi.fn>;
  };
  remoteParticipants: Map<string, unknown>;
  switchActiveDevice: ReturnType<typeof vi.fn>;
  on: (event: string, handler: EventHandler) => IMockRoom;
  emit: (event: string, ...args: unknown[]) => void;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

const latestRoom = vi.hoisted(() => {
  return { current: null as IMockRoom | null };
});

const browserSupport = vi.hoisted(() => {
  return { current: true };
});

// ---------------------------------------------------------------------------
// Mock livekit-client
// ---------------------------------------------------------------------------

vi.mock('livekit-client', () => {
  const ConnectionState = {
    Connected: 'connected',
    Connecting: 'connecting',
    Reconnecting: 'reconnecting',
    Disconnected: 'disconnected',
  } as const;

  const RoomEvent = {
    ConnectionStateChanged: 'connectionStateChanged',
    ActiveSpeakersChanged: 'activeSpeakersChanged',
    TrackSubscribed: 'trackSubscribed',
    TrackUnsubscribed: 'trackUnsubscribed',
    LocalTrackPublished: 'localTrackPublished',
    LocalTrackUnpublished: 'localTrackUnpublished',
    TrackMuted: 'trackMuted',
    TrackUnmuted: 'trackUnmuted',
    ParticipantConnected: 'participantConnected',
    ParticipantDisconnected: 'participantDisconnected',
    ParticipantAttributesChanged: 'participantAttributesChanged',
    Disconnected: 'disconnected',
    ActiveDeviceChanged: 'activeDeviceChanged',
  } as const;

  const Track = {
    Source: {
      Camera: 'camera',
      Microphone: 'microphone',
      ScreenShare: 'screen_share',
      ScreenShareAudio: 'screen_share_audio',
      Unknown: 'unknown',
    } as const,
    Kind: { Audio: 'audio', Video: 'video' } as const,
  };

  // The Room constructor is called with `new` from the hook.
  // We return a plain function that creates a mock room object.
  function MockRoomConstructor() {
    const handlers = new Map<string, EventHandler[]>();

    const room: IMockRoom = {
      handlers,
      localParticipant: {
        identity: 'local-user',
        isMicrophoneEnabled: false,
        isCameraEnabled: false,
        isScreenShareEnabled: false,
        activeDeviceMap: new Map<string, string>(),
        getTrackPublication: vi.fn().mockReturnValue(null),
        setMicrophoneEnabled: vi.fn().mockResolvedValue(undefined),
        setCameraEnabled: vi.fn().mockResolvedValue(undefined),
        setScreenShareEnabled: vi.fn().mockResolvedValue(undefined),
      },
      remoteParticipants: new Map(),
      switchActiveDevice: vi.fn().mockResolvedValue(undefined),
      on(event: string, handler: EventHandler) {
        const list = handlers.get(event) ?? [];
        list.push(handler);
        handlers.set(event, list);
        return room;
      },
      emit(event: string, ...args: unknown[]) {
        for (const handler of handlers.get(event) ?? []) {
          handler(...args);
        }
      },
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };

    latestRoom.current = room;
    return room;
  }

  return {
    ConnectionState,
    RoomEvent,
    Track,
    Room: MockRoomConstructor,
    isBrowserSupported: vi.fn(() => browserSupport.current),
  };
});

// ---------------------------------------------------------------------------
// Mock @/lib/video-filter-processor.js
// ---------------------------------------------------------------------------

vi.mock('@/lib/video-filter-processor.js', () => ({
  VideoFilterProcessor: vi.fn().mockImplementation(() => ({
    updateSettings: vi.fn(),
    destroy: vi.fn().mockResolvedValue(undefined),
  })),
}));

// ---------------------------------------------------------------------------
// Stub navigator.mediaDevices for jsdom
// ---------------------------------------------------------------------------

beforeEach(() => {
  if (!navigator.mediaDevices) {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        enumerateDevices: vi.fn().mockResolvedValue([]),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      configurable: true,
    });
  } else {
    vi.spyOn(navigator.mediaDevices, 'enumerateDevices').mockResolvedValue([]);
    vi.spyOn(navigator.mediaDevices, 'addEventListener').mockImplementation(vi.fn());
    vi.spyOn(navigator.mediaDevices, 'removeEventListener').mockImplementation(vi.fn());
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultOptions(): UseLiveKitOptions {
  return {
    url: 'wss://livekit.example.com',
    token: 'test-token',
    connect: true,
  };
}

function getRoom(): IMockRoom {
  const room = latestRoom.current;
  if (!room) throw new Error('No mock room created yet');
  return room;
}

/** Flush micro-tasks (promises) so Room.connect().then() runs */
async function flushPromises() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useLiveKit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    latestRoom.current = null;
    browserSupport.current = true;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // 1. Disconnected when url/token/connect are null
  // -----------------------------------------------------------------------

  it('GIVEN url is null WHEN rendered THEN connectionState is disconnected and participants are empty', () => {
    const { result } = renderHook(() => useLiveKit({ url: null, token: 'tok', connect: true }));

    expect(result.current.connectionState).toBe('disconnected');
    expect(result.current.remoteParticipants).toEqual([]);
    expect(result.current.localParticipant).toBeNull();
  });

  it('GIVEN token is null WHEN rendered THEN connectionState is disconnected', () => {
    const { result } = renderHook(() =>
      useLiveKit({ url: 'wss://lk', token: null, connect: true }),
    );

    expect(result.current.connectionState).toBe('disconnected');
    expect(result.current.remoteParticipants).toEqual([]);
    expect(result.current.localParticipant).toBeNull();
  });

  it('GIVEN connect is false WHEN rendered THEN connectionState is disconnected', () => {
    const { result } = renderHook(() =>
      useLiveKit({ url: 'wss://lk', token: 'tok', connect: false }),
    );

    expect(result.current.connectionState).toBe('disconnected');
    expect(result.current.remoteParticipants).toEqual([]);
  });

  it('GIVEN WebRTC is unavailable WHEN rendered THEN connectionState is unsupported', () => {
    browserSupport.current = false;

    const { result } = renderHook(() => useLiveKit(defaultOptions()));

    expect(result.current.connectionState).toBe('unsupported');
    expect(latestRoom.current).toBeNull();
  });

  // -----------------------------------------------------------------------
  // 2. Connect flow — transitions to connecting then connected
  // -----------------------------------------------------------------------

  it('GIVEN valid options WHEN rendered THEN connectionState transitions to connecting then connected', async () => {
    const { result } = renderHook(() => useLiveKit(defaultOptions()));

    // Synchronously after the effect, state should be 'connecting'
    expect(result.current.connectionState).toBe('connecting');

    // After the connect promise resolves
    await flushPromises();

    expect(result.current.connectionState).toBe('connected');
  });

  it('GIVEN initial connection attempts fail WHEN later retry succeeds THEN connectionState becomes connected', async () => {
    vi.useFakeTimers();

    const lk = await import('livekit-client');
    const origRoom = lk.Room;
    const connect = vi
      .fn()
      .mockRejectedValueOnce(new Error('connection failed'))
      .mockRejectedValueOnce(new Error('connection failed'))
      .mockRejectedValueOnce(new Error('connection failed'))
      .mockResolvedValueOnce(undefined);

    (lk as Record<string, unknown>).Room = function RetryRoom() {
      const room = new origRoom();
      (room as unknown as IMockRoom).connect = connect;
      latestRoom.current = room as unknown as IMockRoom;
      return room;
    };

    try {
      const { result } = renderHook(() => useLiveKit(defaultOptions()));

      await flushMicrotasks();
      expect(result.current.connectionState).toBe('connecting');
      expect(connect).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(7_000);
      });

      expect(connect).toHaveBeenCalledTimes(4);
      expect(result.current.connectionState).toBe('connected');
    } finally {
      (lk as Record<string, unknown>).Room = origRoom;
      vi.useRealTimers();
    }
  });

  it('GIVEN connection keeps failing WHEN retries are exhausted THEN connectionState becomes failed', async () => {
    vi.useFakeTimers();
    // Start disconnected, then swap the Room mock to reject, then connect
    const { result, rerender } = renderHook((props: UseLiveKitOptions) => useLiveKit(props), {
      initialProps: { url: null, token: null, connect: false } as UseLiveKitOptions,
    });

    // Patch the mock module so the NEXT Room creation rejects on connect
    const lk = await import('livekit-client');
    const origRoom = lk.Room;
    const connect = vi.fn().mockRejectedValue(new Error('connection failed'));
    (lk as Record<string, unknown>).Room = function FailingRoom() {
      const room = new origRoom();
      // Override the connect to reject
      (room as unknown as IMockRoom).connect = connect;
      latestRoom.current = room as unknown as IMockRoom;
      return room;
    };

    try {
      rerender({ url: 'wss://lk', token: 'tok', connect: true });

      await flushMicrotasks();
      expect(result.current.connectionState).toBe('connecting');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(31_000);
      });

      expect(connect).toHaveBeenCalledTimes(7);
      expect(result.current.connectionState).toBe('failed');
    } finally {
      // Restore
      (lk as Record<string, unknown>).Room = origRoom;
      vi.useRealTimers();
    }
  });

  // -----------------------------------------------------------------------
  // 3. toggleMicrophone
  // -----------------------------------------------------------------------

  it('GIVEN connected WHEN toggleMicrophone called THEN isMicrophoneEnabled flips', async () => {
    const { result } = renderHook(() => useLiveKit(defaultOptions()));
    await flushPromises();

    // Mic starts off — connect no longer auto-enables it.
    expect(result.current.isMicrophoneEnabled).toBe(false);

    // Toggle on — sync the mock participant state with what the hook believes
    const room = getRoom();
    room.localParticipant.isMicrophoneEnabled = false;

    await act(async () => {
      await result.current.toggleMicrophone();
    });

    expect(result.current.isMicrophoneEnabled).toBe(true);

    // Toggle back off
    room.localParticipant.isMicrophoneEnabled = true;

    await act(async () => {
      await result.current.toggleMicrophone();
    });

    expect(result.current.isMicrophoneEnabled).toBe(false);
  });

  // -----------------------------------------------------------------------
  // 4. toggleCamera
  // -----------------------------------------------------------------------

  it('GIVEN connected WHEN toggleCamera called THEN isCameraEnabled flips and participants refresh', async () => {
    const { result } = renderHook(() => useLiveKit(defaultOptions()));
    await flushPromises();

    expect(result.current.isCameraEnabled).toBe(false);

    const room = getRoom();
    // Mirror real LiveKit behavior: setCameraEnabled flips the authoritative flag.
    room.localParticipant.setCameraEnabled = vi
      .fn()
      .mockImplementation(async (enabled: boolean) => {
        room.localParticipant.isCameraEnabled = enabled;
      });

    await act(async () => {
      await result.current.toggleCamera();
    });

    expect(result.current.isCameraEnabled).toBe(true);

    // The local participant should be refreshed (non-null after camera toggle)
    expect(result.current.localParticipant).not.toBeNull();
    expect(result.current.localParticipant?.identity).toBe('local-user');

    await act(async () => {
      await result.current.toggleCamera();
    });

    expect(result.current.isCameraEnabled).toBe(false);
  });

  // -----------------------------------------------------------------------
  // 5. Disconnect — connect becomes false after being connected
  // -----------------------------------------------------------------------

  it('GIVEN connected WHEN connect becomes false THEN state resets to disconnected', async () => {
    const { result, rerender } = renderHook((props: UseLiveKitOptions) => useLiveKit(props), {
      initialProps: defaultOptions(),
    });

    await flushPromises();
    expect(result.current.connectionState).toBe('connected');

    rerender({ url: 'wss://lk', token: 'tok', connect: false });

    expect(result.current.connectionState).toBe('disconnected');
    expect(result.current.remoteParticipants).toEqual([]);
    expect(result.current.localParticipant).toBeNull();
    expect(result.current.isMicrophoneEnabled).toBe(false);
    expect(result.current.isCameraEnabled).toBe(false);
    expect(result.current.speakingMap.size).toBe(0);
  });

  it('GIVEN connected WHEN url becomes null THEN state resets to disconnected', async () => {
    const { result, rerender } = renderHook((props: UseLiveKitOptions) => useLiveKit(props), {
      initialProps: defaultOptions(),
    });

    await flushPromises();
    expect(result.current.connectionState).toBe('connected');

    rerender({ url: null, token: 'tok', connect: true });

    expect(result.current.connectionState).toBe('disconnected');
    expect(result.current.isMicrophoneEnabled).toBe(false);
  });

  // -----------------------------------------------------------------------
  // 6. setOutputVolume
  // -----------------------------------------------------------------------

  it('GIVEN audio elements exist WHEN setOutputVolume called THEN volume is adjusted', async () => {
    const { result } = renderHook(() => useLiveKit(defaultOptions()));
    await flushPromises();

    // Simulate a remote audio track subscription by emitting TrackSubscribed event.
    const fakeAudioEl = document.createElement('audio');
    const fakeTrack = {
      kind: 'audio',
      attach: () => fakeAudioEl,
    };

    act(() => {
      getRoom().emit('trackSubscribed', fakeTrack, {}, { identity: 'remote-1' });
    });

    act(() => {
      result.current.setOutputVolume(0.5);
    });

    expect(fakeAudioEl.volume).toBe(0.5);
  });

  it('GIVEN a remote participant has an audio track WHEN participants refresh THEN exposes the microphone track', async () => {
    const { result } = renderHook(() => useLiveKit(defaultOptions()));
    await flushPromises();

    const audioTrack = {} as MediaStreamTrack;
    const room = getRoom();
    room.remoteParticipants.set('ai-interviewer', {
      identity: 'ai-interviewer',
      isAgent: true,
      getTrackPublication: vi.fn((source: string) =>
        source === 'microphone'
          ? {
              isMuted: false,
              track: { mediaStreamTrack: audioTrack },
            }
          : null,
      ),
    });

    act(() => {
      room.emit('participantConnected');
    });

    expect(result.current.remoteParticipants).toEqual([
      expect.objectContaining({
        identity: 'ai-interviewer',
        isAgent: true,
        audioTrack,
      }),
    ]);
  });

  it('GIVEN an avatar participant publishes video WHEN participants refresh THEN merges avatar video into the agent identity', async () => {
    const { result } = renderHook(() => useLiveKit(defaultOptions()));
    await flushPromises();

    const audioTrack = {} as MediaStreamTrack;
    const avatarVideoTrack = {} as MediaStreamTrack;
    const room = getRoom();
    room.remoteParticipants.set('ai-interviewer', {
      identity: 'ai-interviewer',
      isAgent: true,
      getTrackPublication: vi.fn((source: string) =>
        source === 'microphone'
          ? {
              isMuted: false,
              track: { mediaStreamTrack: audioTrack },
            }
          : null,
      ),
    });
    room.remoteParticipants.set('ai-interviewer-avatar', {
      identity: 'ai-interviewer-avatar',
      isAgent: false,
      getTrackPublication: vi.fn((source: string) =>
        source === 'camera'
          ? {
              isMuted: false,
              track: { mediaStreamTrack: avatarVideoTrack },
            }
          : null,
      ),
    });

    act(() => {
      room.emit('participantConnected');
    });

    expect(result.current.remoteParticipants).toEqual([
      expect.objectContaining({
        identity: 'ai-interviewer',
        isAgent: true,
        audioTrack,
        hasVideo: true,
        videoTrack: avatarVideoTrack,
      }),
    ]);
  });

  it('GIVEN agent media publications use unknown source WHEN participants refresh THEN still exposes audio and avatar video', async () => {
    const { result } = renderHook(() => useLiveKit(defaultOptions()));
    await flushPromises();

    const audioTrack = {} as MediaStreamTrack;
    const avatarVideoTrack = {} as MediaStreamTrack;
    const room = getRoom();
    room.remoteParticipants.set('ai-interviewer', {
      identity: 'ai-interviewer',
      isAgent: true,
      getTrackPublication: vi.fn().mockReturnValue(null),
      getTrackPublications: vi.fn().mockReturnValue([
        {
          kind: 'audio',
          source: 'unknown',
          isMuted: false,
          track: { mediaStreamTrack: audioTrack },
        },
      ]),
    });
    room.remoteParticipants.set('ai-interviewer-avatar', {
      identity: 'ai-interviewer-avatar',
      isAgent: false,
      getTrackPublication: vi.fn().mockReturnValue(null),
      getTrackPublications: vi.fn().mockReturnValue([
        {
          kind: 'video',
          source: 'unknown',
          isMuted: false,
          track: { mediaStreamTrack: avatarVideoTrack },
        },
      ]),
    });

    act(() => {
      room.emit('participantConnected');
    });

    expect(result.current.remoteParticipants).toEqual([
      expect.objectContaining({
        identity: 'ai-interviewer',
        isAgent: true,
        audioTrack,
        hasVideo: true,
        videoTrack: avatarVideoTrack,
      }),
    ]);
  });

  it('GIVEN an avatar participant is active speaker WHEN speakers change THEN marks the agent identity as speaking', async () => {
    const { result } = renderHook(() => useLiveKit(defaultOptions()));
    await flushPromises();
    getRoom().remoteParticipants.set('ai-interviewer-avatar', {
      identity: 'ai-interviewer-avatar',
      isAgent: false,
      getTrackPublication: vi.fn().mockReturnValue(null),
    });

    act(() => {
      getRoom().emit('activeSpeakersChanged', [
        {
          identity: 'ai-interviewer-avatar',
        },
      ]);
    });

    expect(result.current.speakingMap.get('ai-interviewer')).toBe(true);
    expect(result.current.speakingMap.get('ai-interviewer-avatar')).toBeUndefined();
  });

  it('GIVEN setOutputVolume called with value > 1 THEN volume is clamped to 1', async () => {
    const { result } = renderHook(() => useLiveKit(defaultOptions()));
    await flushPromises();

    const fakeAudioEl = document.createElement('audio');
    const fakeTrack = { kind: 'audio', attach: () => fakeAudioEl };

    act(() => {
      getRoom().emit('trackSubscribed', fakeTrack, {}, { identity: 'r1' });
    });

    act(() => {
      result.current.setOutputVolume(1.5);
    });

    expect(fakeAudioEl.volume).toBe(1);
  });

  it('GIVEN setOutputVolume called with value < 0 THEN volume is clamped to 0', async () => {
    const { result } = renderHook(() => useLiveKit(defaultOptions()));
    await flushPromises();

    const fakeAudioEl = document.createElement('audio');
    const fakeTrack = { kind: 'audio', attach: () => fakeAudioEl };

    act(() => {
      getRoom().emit('trackSubscribed', fakeTrack, {}, { identity: 'r2' });
    });

    act(() => {
      result.current.setOutputVolume(-0.5);
    });

    expect(fakeAudioEl.volume).toBe(0);
  });

  // -----------------------------------------------------------------------
  // 7. Cleanup on unmount
  // -----------------------------------------------------------------------

  it('GIVEN connected WHEN unmounted THEN room.disconnect is called', async () => {
    const { unmount } = renderHook(() => useLiveKit(defaultOptions()));
    await flushPromises();

    const room = getRoom();

    unmount();

    expect(room.disconnect).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 8. Microphone is off by default on connect
  // -----------------------------------------------------------------------

  it('GIVEN first connection WHEN connect resolves THEN microphone stays off', async () => {
    const { result } = renderHook(() => useLiveKit(defaultOptions()));
    await flushPromises();

    expect(result.current.isMicrophoneEnabled).toBe(false);
    const room = getRoom();
    expect(room.localParticipant.setMicrophoneEnabled).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 9. Initial state values
  // -----------------------------------------------------------------------

  it('GIVEN connected WHEN checking initial return values THEN all defaults are correct', async () => {
    const { result } = renderHook(() => useLiveKit(defaultOptions()));
    await flushPromises();

    expect(result.current.isCameraEnabled).toBe(false);
    expect(result.current.audioInputDevices).toEqual([]);
    expect(result.current.videoInputDevices).toEqual([]);
    expect(result.current.activeAudioDeviceId).toBeNull();
    expect(result.current.activeVideoDeviceId).toBeNull();
    expect(result.current.speakingMap.size).toBe(0);
    expect(result.current.remoteParticipants).toEqual([]);
    expect(result.current.isScreenShareEnabled).toBe(false);
  });

  // -----------------------------------------------------------------------
  // 10. Screen share
  // -----------------------------------------------------------------------

  it('GIVEN connected WHEN toggleScreenShare called THEN isScreenShareEnabled flips', async () => {
    const { result } = renderHook(() => useLiveKit(defaultOptions()));
    await flushPromises();

    expect(result.current.isScreenShareEnabled).toBe(false);

    await act(async () => {
      await result.current.toggleScreenShare();
    });

    expect(result.current.isScreenShareEnabled).toBe(true);

    getRoom().localParticipant.isScreenShareEnabled = true;
    await act(async () => {
      await result.current.toggleScreenShare();
    });

    expect(result.current.isScreenShareEnabled).toBe(false);
  });

  it('GIVEN screen share fails WHEN toggleScreenShare called THEN isScreenShareEnabled stays false', async () => {
    const { result } = renderHook(() => useLiveKit(defaultOptions()));
    await flushPromises();

    getRoom().localParticipant.setScreenShareEnabled.mockRejectedValueOnce(
      new Error('user cancelled'),
    );

    await act(async () => {
      await result.current.toggleScreenShare();
    });

    expect(result.current.isScreenShareEnabled).toBe(false);
  });
});
