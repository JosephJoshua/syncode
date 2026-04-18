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
    activeDeviceMap: Map<string, string>;
    getTrackPublication: ReturnType<typeof vi.fn>;
    setMicrophoneEnabled: ReturnType<typeof vi.fn>;
    setCameraEnabled: ReturnType<typeof vi.fn>;
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
    Disconnected: 'disconnected',
    ActiveDeviceChanged: 'activeDeviceChanged',
  } as const;

  const Track = {
    Source: { Camera: 'camera', Microphone: 'microphone' } as const,
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
        activeDeviceMap: new Map<string, string>(),
        getTrackPublication: vi.fn().mockReturnValue(null),
        setMicrophoneEnabled: vi.fn().mockResolvedValue(undefined),
        setCameraEnabled: vi.fn().mockResolvedValue(undefined),
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useLiveKit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    latestRoom.current = null;
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

  it('GIVEN connection fails WHEN rendered THEN connectionState becomes failed', async () => {
    // Start disconnected, then swap the Room mock to reject, then connect
    const { result, rerender } = renderHook((props: UseLiveKitOptions) => useLiveKit(props), {
      initialProps: { url: null, token: null, connect: false } as UseLiveKitOptions,
    });

    // Patch the mock module so the NEXT Room creation rejects on connect
    const lk = await import('livekit-client');
    const origRoom = lk.Room;
    (lk as Record<string, unknown>).Room = function FailingRoom() {
      const room = new origRoom();
      // Override the connect to reject
      (room as unknown as IMockRoom).connect = vi
        .fn()
        .mockRejectedValue(new Error('connection failed'));
      latestRoom.current = room as unknown as IMockRoom;
      return room;
    };

    rerender({ url: 'wss://lk', token: 'tok', connect: true });

    await flushPromises();

    expect(result.current.connectionState).toBe('failed');

    // Restore
    (lk as Record<string, unknown>).Room = origRoom;
  });

  // -----------------------------------------------------------------------
  // 3. toggleMicrophone
  // -----------------------------------------------------------------------

  it('GIVEN connected WHEN toggleMicrophone called THEN isMicrophoneEnabled flips', async () => {
    const { result } = renderHook(() => useLiveKit(defaultOptions()));
    await flushPromises();

    // After connect, mic is auto-enabled
    expect(result.current.isMicrophoneEnabled).toBe(true);

    // Toggle off — sync the mock participant state with what the hook believes
    const room = getRoom();
    room.localParticipant.isMicrophoneEnabled = true;

    await act(async () => {
      await result.current.toggleMicrophone();
    });

    expect(result.current.isMicrophoneEnabled).toBe(false);

    // Toggle back on
    room.localParticipant.isMicrophoneEnabled = false;

    await act(async () => {
      await result.current.toggleMicrophone();
    });

    expect(result.current.isMicrophoneEnabled).toBe(true);
  });

  // -----------------------------------------------------------------------
  // 4. toggleCamera
  // -----------------------------------------------------------------------

  it('GIVEN connected WHEN toggleCamera called THEN isCameraEnabled flips and participants refresh', async () => {
    const { result } = renderHook(() => useLiveKit(defaultOptions()));
    await flushPromises();

    expect(result.current.isCameraEnabled).toBe(false);

    const room = getRoom();
    room.localParticipant.isCameraEnabled = false;

    await act(async () => {
      await result.current.toggleCamera();
    });

    expect(result.current.isCameraEnabled).toBe(true);

    // The local participant should be refreshed (non-null after camera toggle)
    expect(result.current.localParticipant).not.toBeNull();
    expect(result.current.localParticipant?.identity).toBe('local-user');

    // Disable camera
    room.localParticipant.isCameraEnabled = true;

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
  // 8. Auto-enable microphone on first connection
  // -----------------------------------------------------------------------

  it('GIVEN first connection WHEN connect resolves THEN microphone is auto-enabled', async () => {
    const { result } = renderHook(() => useLiveKit(defaultOptions()));
    await flushPromises();

    expect(result.current.isMicrophoneEnabled).toBe(true);
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
  });
});
