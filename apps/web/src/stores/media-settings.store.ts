import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { VideoQualityPreset } from '@/components/media-settings-panel.js';

export interface AudioProcessingSettings {
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
}

export type VideoPanelMode = 'floating' | 'docked';

interface MediaSettingsState {
  audioInputDeviceId: string | null;
  videoInputDeviceId: string | null;
  audioOutputDeviceId: string | null;
  audioProcessing: AudioProcessingSettings;
  videoQuality: VideoQualityPreset;
  videoPanelMode: VideoPanelMode;
  outputVolume: number;
  setAudioInputDeviceId: (id: string | null) => void;
  setVideoInputDeviceId: (id: string | null) => void;
  setAudioOutputDeviceId: (id: string | null) => void;
  setAudioProcessing: (settings: AudioProcessingSettings) => void;
  setVideoQuality: (preset: VideoQualityPreset) => void;
  setVideoPanelMode: (mode: VideoPanelMode) => void;
  setOutputVolume: (volume: number) => void;
  reconcileDevices: (available: {
    audioInputIds: ReadonlySet<string>;
    videoInputIds: ReadonlySet<string>;
    audioOutputIds: ReadonlySet<string>;
  }) => void;
}

const NOOP_STORAGE: Storage = {
  length: 0,
  clear: () => {},
  getItem: () => null,
  key: () => null,
  removeItem: () => {},
  setItem: () => {},
};

const DEFAULT_AUDIO_PROCESSING: AudioProcessingSettings = {
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: false,
};

export const useMediaSettingsStore = create<MediaSettingsState>()(
  persist(
    (set) => ({
      audioInputDeviceId: null,
      videoInputDeviceId: null,
      audioOutputDeviceId: null,
      audioProcessing: DEFAULT_AUDIO_PROCESSING,
      videoQuality: 'medium',
      videoPanelMode: 'docked',
      outputVolume: 1,
      setAudioInputDeviceId: (id) => set({ audioInputDeviceId: id }),
      setVideoInputDeviceId: (id) => set({ videoInputDeviceId: id }),
      setAudioOutputDeviceId: (id) => set({ audioOutputDeviceId: id }),
      setAudioProcessing: (settings) => set({ audioProcessing: settings }),
      setVideoQuality: (preset) => set({ videoQuality: preset }),
      setVideoPanelMode: (mode) => set({ videoPanelMode: mode }),
      setOutputVolume: (volume) => set({ outputVolume: Math.max(0, Math.min(1, volume)) }),
      reconcileDevices: ({ audioInputIds, videoInputIds, audioOutputIds }) =>
        set((state) => {
          const patch: Partial<MediaSettingsState> = {};
          if (state.audioInputDeviceId && !audioInputIds.has(state.audioInputDeviceId)) {
            patch.audioInputDeviceId = null;
          }
          if (state.videoInputDeviceId && !videoInputIds.has(state.videoInputDeviceId)) {
            patch.videoInputDeviceId = null;
          }
          if (state.audioOutputDeviceId && !audioOutputIds.has(state.audioOutputDeviceId)) {
            patch.audioOutputDeviceId = null;
          }
          return patch;
        }),
    }),
    {
      name: 'syncode.media-settings.v1',
      version: 1,
      // Some test runners report `typeof window === 'object'` but expose a
      // localStorage stub that lacks setItem. Probe for the real method
      // before handing it to zustand.
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') return NOOP_STORAGE;
        const ls = window.localStorage;
        if (!ls || typeof ls.setItem !== 'function') return NOOP_STORAGE;
        return ls;
      }),
      partialize: (state) => ({
        audioInputDeviceId: state.audioInputDeviceId,
        videoInputDeviceId: state.videoInputDeviceId,
        audioOutputDeviceId: state.audioOutputDeviceId,
        audioProcessing: state.audioProcessing,
        videoQuality: state.videoQuality,
        videoPanelMode: state.videoPanelMode,
        outputVolume: state.outputVolume,
      }),
    },
  ),
);
