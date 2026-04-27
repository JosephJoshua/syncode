import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type UseYjsCollabOptions, useYjsCollab } from './use-yjs-collab.js';

// Mock the provider so we don't create real WebSocket connections
const mockConnect = vi.fn();
const mockDestroy = vi.fn();
const mockSetLocalStateField = vi.fn();

vi.mock('@/lib/yjs-collab-provider.js', async () => {
  const Y = await import('yjs');
  const { Awareness } = await import('y-protocols/awareness');

  return {
    YjsCollabProvider: vi.fn().mockImplementation(() => {
      const doc = new Y.Doc();
      const awareness = new Awareness(doc);
      awareness.setLocalStateField = mockSetLocalStateField;
      return {
        doc,
        awareness,
        connect: mockConnect,
        destroy: mockDestroy,
      };
    }),
    codeTextKey: (language: string) => `code:${language}`,
  };
});

// Mock sonner (toast)
vi.mock('sonner', () => ({
  toast: { info: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function defaultOptions(): UseYjsCollabOptions {
  return {
    collabUrl: 'http://localhost:3001',
    collabToken: 'test-token',
    roomId: 'room-1',
    userName: 'Alice',
    userColor: '#00e599',
    onRoomStatePatch: vi.fn(),
    onParticipantReady: vi.fn(),
  };
}

describe('useYjsCollab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('GIVEN no collabUrl WHEN rendered THEN returns disconnected with null doc/awareness', () => {
    const opts = { ...defaultOptions(), collabUrl: null, collabToken: null };
    const { result } = renderHook(() => useYjsCollab(opts));

    expect(result.current.status).toBe('disconnected');
    expect(result.current.doc).toBeNull();
    expect(result.current.awareness).toBeNull();
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('GIVEN valid options WHEN rendered THEN creates provider and returns doc/awareness', () => {
    const opts = defaultOptions();
    const { result } = renderHook(() => useYjsCollab(opts));

    expect(mockConnect).toHaveBeenCalledOnce();
    expect(result.current.doc).not.toBeNull();
    expect(result.current.awareness).not.toBeNull();
  });

  it('GIVEN connected WHEN userName changes THEN updates awareness without reconnecting', () => {
    const opts = defaultOptions();
    const { rerender } = renderHook((props) => useYjsCollab(props), {
      initialProps: opts,
    });

    const connectCalls = mockConnect.mock.calls.length;

    rerender({ ...opts, userName: 'Bob' });

    // Awareness should be updated but no new connection
    expect(mockSetLocalStateField).toHaveBeenCalledWith(
      'user',
      expect.objectContaining({
        name: 'Bob',
      }),
    );
    expect(mockConnect.mock.calls.length).toBe(connectCalls);
  });

  it('GIVEN connected WHEN userColor changes THEN updates awareness without reconnecting', () => {
    const opts = defaultOptions();
    const { rerender } = renderHook((props) => useYjsCollab(props), {
      initialProps: opts,
    });

    const connectCalls = mockConnect.mock.calls.length;

    rerender({ ...opts, userColor: '#60a5fa' });

    expect(mockSetLocalStateField).toHaveBeenCalledWith(
      'user',
      expect.objectContaining({
        color: '#60a5fa',
      }),
    );
    expect(mockConnect.mock.calls.length).toBe(connectCalls);
  });

  it('GIVEN connected WHEN unmounted THEN destroys provider immediately', () => {
    const opts = defaultOptions();
    const { unmount } = renderHook(() => useYjsCollab(opts));

    unmount();
    expect(mockDestroy).toHaveBeenCalledOnce();
  });

  it('GIVEN connected WHEN collabUrl becomes null THEN destroys provider immediately', () => {
    const opts = defaultOptions();
    const { rerender } = renderHook((props) => useYjsCollab(props), {
      initialProps: opts,
    });

    rerender({ ...opts, collabUrl: null, collabToken: null });

    expect(mockDestroy).toHaveBeenCalledOnce();
  });
});
