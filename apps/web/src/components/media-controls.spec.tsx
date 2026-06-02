import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MediaControls } from './media-controls.js';

const baseProps = {
  isMicrophoneEnabled: false,
  isCameraEnabled: false,
  isScreenShareEnabled: false,
  canScreenShare: true,
  onToggleMicrophone: vi.fn(),
  onToggleCamera: vi.fn(),
  onToggleScreenShare: vi.fn(),
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

describe('MediaControls', () => {
  it('GIVEN WebRTC is unsupported WHEN rendered THEN shows blocked media status', () => {
    render(<MediaControls {...baseProps} connectionState="unsupported" />);

    expect(screen.getByText('webrtc blocked')).toBeInTheDocument();
  });
});
