import { beforeEach, describe, expect, it } from 'vitest';
import { useMediaSettingsStore } from './media-settings.store.js';

const initialState = useMediaSettingsStore.getState();

const reset = () => {
  useMediaSettingsStore.setState(initialState, true);
};

const emptyDeviceSets = {
  audioInputIds: new Set<string>(),
  videoInputIds: new Set<string>(),
  audioOutputIds: new Set<string>(),
};

describe('useMediaSettingsStore.reconcileDevices', () => {
  beforeEach(() => {
    reset();
  });

  it('GIVEN stored audioInputId not in device list WHEN reconcileDevices THEN audioInputId becomes null', () => {
    useMediaSettingsStore.getState().setAudioInputDeviceId('mic-1');

    useMediaSettingsStore.getState().reconcileDevices({
      ...emptyDeviceSets,
      audioInputIds: new Set(['mic-2', 'mic-3']),
    });

    expect(useMediaSettingsStore.getState().audioInputDeviceId).toBeNull();
  });

  it('GIVEN stored audioInputId IS in device list WHEN reconcileDevices THEN audioInputId preserved', () => {
    useMediaSettingsStore.getState().setAudioInputDeviceId('mic-1');

    useMediaSettingsStore.getState().reconcileDevices({
      ...emptyDeviceSets,
      audioInputIds: new Set(['mic-1', 'mic-2']),
    });

    expect(useMediaSettingsStore.getState().audioInputDeviceId).toBe('mic-1');
  });

  it('GIVEN stored videoInputId not in device list WHEN reconcileDevices THEN videoInputId becomes null', () => {
    useMediaSettingsStore.getState().setVideoInputDeviceId('cam-1');

    useMediaSettingsStore.getState().reconcileDevices({
      ...emptyDeviceSets,
      videoInputIds: new Set(['cam-2']),
    });

    expect(useMediaSettingsStore.getState().videoInputDeviceId).toBeNull();
  });

  it('GIVEN stored videoInputId IS in device list WHEN reconcileDevices THEN videoInputId preserved', () => {
    useMediaSettingsStore.getState().setVideoInputDeviceId('cam-1');

    useMediaSettingsStore.getState().reconcileDevices({
      ...emptyDeviceSets,
      videoInputIds: new Set(['cam-1']),
    });

    expect(useMediaSettingsStore.getState().videoInputDeviceId).toBe('cam-1');
  });

  it('GIVEN stored audioOutputId not in device list WHEN reconcileDevices THEN audioOutputId becomes null', () => {
    useMediaSettingsStore.getState().setAudioOutputDeviceId('spk-1');

    useMediaSettingsStore.getState().reconcileDevices({
      ...emptyDeviceSets,
      audioOutputIds: new Set(['spk-2']),
    });

    expect(useMediaSettingsStore.getState().audioOutputDeviceId).toBeNull();
  });

  it('GIVEN stored audioOutputId IS in device list WHEN reconcileDevices THEN audioOutputId preserved', () => {
    useMediaSettingsStore.getState().setAudioOutputDeviceId('spk-1');

    useMediaSettingsStore.getState().reconcileDevices({
      ...emptyDeviceSets,
      audioOutputIds: new Set(['spk-1', 'spk-2']),
    });

    expect(useMediaSettingsStore.getState().audioOutputDeviceId).toBe('spk-1');
  });

  it('GIVEN empty device list WHEN reconcileDevices THEN all device ids become null', () => {
    const { setAudioInputDeviceId, setVideoInputDeviceId, setAudioOutputDeviceId } =
      useMediaSettingsStore.getState();
    setAudioInputDeviceId('mic-1');
    setVideoInputDeviceId('cam-1');
    setAudioOutputDeviceId('spk-1');

    useMediaSettingsStore.getState().reconcileDevices(emptyDeviceSets);

    const state = useMediaSettingsStore.getState();
    expect(state.audioInputDeviceId).toBeNull();
    expect(state.videoInputDeviceId).toBeNull();
    expect(state.audioOutputDeviceId).toBeNull();
  });
});

describe('useMediaSettingsStore.setOutputVolume', () => {
  beforeEach(() => {
    reset();
  });

  it('GIVEN setOutputVolume(-0.5) WHEN called THEN clamped to 0', () => {
    useMediaSettingsStore.getState().setOutputVolume(-0.5);

    expect(useMediaSettingsStore.getState().outputVolume).toBe(0);
  });

  it('GIVEN setOutputVolume(1.5) WHEN called THEN clamped to 1', () => {
    useMediaSettingsStore.getState().setOutputVolume(1.5);

    expect(useMediaSettingsStore.getState().outputVolume).toBe(1);
  });

  it('GIVEN setOutputVolume(0.7) WHEN called THEN stored as 0.7', () => {
    useMediaSettingsStore.getState().setOutputVolume(0.7);

    expect(useMediaSettingsStore.getState().outputVolume).toBe(0.7);
  });
});
