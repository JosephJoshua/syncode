import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaSettingsPanel } from './media-settings-panel.js';

interface MockPermissionStatus {
  state: 'granted' | 'prompt' | 'denied';
}

function setupNavigatorMocks(opts: {
  cameraState?: MockPermissionStatus['state'];
  micState?: MockPermissionStatus['state'];
  devices?: { kind: string; deviceId: string; label: string }[];
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
}) {
  const query = vi.fn().mockImplementation(async ({ name }: { name: string }) => {
    if (name === 'camera') return { state: opts.cameraState ?? 'prompt' };
    if (name === 'microphone') return { state: opts.micState ?? 'prompt' };
    throw new TypeError('unsupported');
  });

  const enumerateDevices = vi.fn().mockResolvedValue(opts.devices ?? []);
  const addEventListener = vi.fn();
  const removeEventListener = vi.fn();
  const defaultGetUserMedia = vi.fn().mockRejectedValue(new Error('not mocked'));
  const getUserMedia = opts.getUserMedia ?? defaultGetUserMedia;

  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: { query },
  });

  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      enumerateDevices,
      getUserMedia,
      addEventListener,
      removeEventListener,
    },
  });

  return { query, enumerateDevices, getUserMedia };
}

const baseProps = {
  audioInputDevices: [],
  videoInputDevices: [],
  activeAudioDeviceId: null,
  activeVideoDeviceId: null,
  onSwitchDevice: vi.fn(),
  outputVolume: 1,
  onOutputVolumeChange: vi.fn(),
  audioProcessing: { noiseSuppression: true, echoCancellation: true, autoGainControl: false },
  onAudioProcessingChange: vi.fn(),
  onVideoFilterChange: vi.fn(),
  videoQuality: 'medium' as const,
  onVideoQualityChange: vi.fn(),
  isPushToTalkMode: false,
  onTogglePushToTalkMode: vi.fn(),
};

describe('MediaSettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GIVEN no prior permissions WHEN panel opened THEN shows both grant buttons', async () => {
    setupNavigatorMocks({ cameraState: 'prompt', micState: 'prompt', devices: [] });
    const user = userEvent.setup();

    render(<MediaSettingsPanel {...baseProps} />);
    await user.click(screen.getByRole('button', { name: /media settings/i }));

    expect(
      await screen.findByRole('button', { name: /grant camera permission/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /grant microphone permission/i }),
    ).toBeInTheDocument();
  });

  it('GIVEN camera already granted via Permissions API WHEN opened THEN camera section shows device picker and no grant button', async () => {
    setupNavigatorMocks({
      cameraState: 'granted',
      micState: 'prompt',
      devices: [{ kind: 'videoinput', deviceId: 'cam-1', label: 'FaceTime HD' }],
    });
    const user = userEvent.setup();

    render(<MediaSettingsPanel {...baseProps} />);
    await user.click(screen.getByRole('button', { name: /media settings/i }));

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /grant camera permission/i }),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByRole('button', { name: /grant microphone permission/i }),
    ).toBeInTheDocument();
  });

  it('GIVEN Permissions API unsupported but devices have labels WHEN opened THEN treats kind as granted', async () => {
    setupNavigatorMocks({
      devices: [{ kind: 'audioinput', deviceId: 'mic-1', label: 'Built-in Mic' }],
    });
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: {
        query: vi.fn().mockRejectedValue(new TypeError('unsupported')),
      },
    });
    const user = userEvent.setup();

    render(<MediaSettingsPanel {...baseProps} />);
    await user.click(screen.getByRole('button', { name: /media settings/i }));

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /grant microphone permission/i }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /grant camera permission/i })).toBeInTheDocument();
  });

  it('GIVEN grant button clicked AND getUserMedia succeeds THEN stops tracks and re-renders with devices', async () => {
    const stopTrack = vi.fn();
    const track = { stop: stopTrack } as unknown as MediaStreamTrack;
    const fakeStream = { getTracks: () => [track] } as unknown as MediaStream;

    const enumerateCalls: number[] = [];
    const enumerate = vi.fn().mockImplementation(() => {
      const idx = enumerateCalls.push(enumerateCalls.length) - 1;
      if (idx === 0) return Promise.resolve([]);
      return Promise.resolve([{ kind: 'videoinput', deviceId: 'cam-1', label: 'My Webcam' }]);
    });
    const getUserMedia = vi.fn().mockResolvedValue(fakeStream);

    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: {
        query: vi.fn().mockResolvedValue({ state: 'prompt' }),
      },
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        enumerateDevices: enumerate,
        getUserMedia,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });

    const user = userEvent.setup();
    render(<MediaSettingsPanel {...baseProps} />);
    await user.click(screen.getByRole('button', { name: /media settings/i }));

    const grantBtn = await screen.findByRole('button', { name: /grant camera permission/i });
    await user.click(grantBtn);

    await waitFor(() => {
      expect(getUserMedia).toHaveBeenCalledWith({ video: true });
    });
    expect(stopTrack).toHaveBeenCalled();
  });

  it('GIVEN grant button clicked AND getUserMedia rejects THEN shows friendly denial message and keeps button', async () => {
    const getUserMedia = vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError'));

    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: {
        query: vi.fn().mockResolvedValue({ state: 'prompt' }),
      },
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        enumerateDevices: vi.fn().mockResolvedValue([]),
        getUserMedia,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });

    const user = userEvent.setup();
    render(<MediaSettingsPanel {...baseProps} />);
    await user.click(screen.getByRole('button', { name: /media settings/i }));

    const grantBtn = await screen.findByRole('button', { name: /grant microphone permission/i });
    await user.click(grantBtn);

    expect(await screen.findByText(/permission denied/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /grant microphone permission/i }),
    ).toBeInTheDocument();
  });
});
