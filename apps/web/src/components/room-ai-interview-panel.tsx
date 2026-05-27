import type { AiInterviewCodeContext } from '@syncode/contracts';
import { Avatar, AvatarFallback, AvatarImage, Button } from '@syncode/ui';
import { Bot, Loader2, Mic, MicOff, Send } from 'lucide-react';
import type { KeyboardEvent, ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InlineCommentMarkdown } from './inline-comment-markdown.js';
import type { Participant } from './room-participant-card.js';

export interface AiInterviewMessage {
  id?: string;
  createdAt?: number;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  followUpQuestion?: string;
  codeContext?: AiInterviewCodeContext;
  codeAnnotations?: Array<{ line: number; comment: string }>;
  audioUrl?: string;
}

export type AiInterviewPanelMode = 'legacy' | 'realtime';

export type VoiceCaptureState = 'idle' | 'requesting' | 'listening' | 'transcribing' | 'responding';
export type VoicePermissionResult = 'granted' | 'denied' | 'no_device' | 'unavailable';

interface VoiceTranscriptionRequest {
  audioBase64: string;
  mimeType: string;
  language?: string;
}

const VOICE_RECORDING_MIN_MS = 700;
const VOICE_SILENCE_AUTO_STOP_MS = 1400;
const VOICE_ACTIVITY_THRESHOLD = 0.02;
const VOICE_RECORDER_TIMESLICE_MS = 300;
const VOICE_STOP_FALLBACK_MS = 1_500;
const VOICE_TRANSCRIPTION_TIMEOUT_MS = 12_000;
const VOICE_AUDIO_PREPARE_TIMEOUT_MS = 8_000;
const VOICE_BASE64_ENCODE_TIMEOUT_MS = 4_000;
const VOICE_MAX_RECORDING_MS = 45_000;
const VOICE_MAX_BLOB_BYTES = 2_800_000;
const VOICE_TARGET_SAMPLE_RATE = 16_000;
const VOICE_AUTO_RESTART_DELAY_MS = 220;
const VOICE_INTERRUPTION_THRESHOLD = 0.06;
const VOICE_INTERRUPTION_HOLD_MS = 260;
const VOICE_WAVE_OFFSETS = Array.from({ length: 21 }, (_, position) => position - 10);
const VOICE_SPEECH_SYNTHESIS_CHUNK_LENGTH = 220;
const STOP_VOICE_CAPTURE_DEFAULT_OPTIONS: Readonly<{ transcribe: boolean }> = { transcribe: true };

interface LatestAssistantMessage {
  stableId: string;
  message: AiInterviewMessage;
}

export function resolveVoiceStatusText(
  t: (key: string) => string,
  state: VoiceCaptureState,
): string | null {
  switch (state) {
    case 'requesting':
      return t('workspace.aiInterviewVoiceRequesting');
    case 'transcribing':
      return t('workspace.aiInterviewVoiceTranscribing');
    case 'responding':
      return t('workspace.aiInterviewVoiceResponding');
    case 'listening':
      return t('workspace.aiInterviewVoiceListening');
    default:
      return null;
  }
}

function resolveRealtimeAgentStatusText(
  t: (key: string) => string,
  state: 'initializing' | 'idle' | 'listening' | 'thinking' | 'speaking',
  userState: 'speaking' | 'listening' | 'away',
): string {
  if (userState === 'away') {
    return t('workspace.aiInterviewVoiceListening');
  }
  if (userState === 'speaking') {
    return t('workspace.aiInterviewVoiceListening');
  }
  if (state === 'speaking') {
    return t('workspace.aiInterviewVoiceResponding');
  }
  if (state === 'thinking' || state === 'initializing') {
    return t('workspace.aiInterviewBusy');
  }
  return t('workspace.aiInterviewVoiceListening');
}

function renderVoiceInputIcon({
  isListening,
  isRequestingVoice,
  isTranscribingVoice,
  isAssistantResponding,
}: {
  isListening: boolean;
  isRequestingVoice: boolean;
  isTranscribingVoice: boolean;
  isAssistantResponding: boolean;
}): ReactNode {
  if (isTranscribingVoice) {
    return <Loader2 className="size-3.5 animate-spin" />;
  }
  if (isAssistantResponding) {
    return <Bot className="size-3.5 animate-pulse" />;
  }
  if (isListening || isRequestingVoice) {
    return <Mic className="size-3.5 animate-pulse" />;
  }
  return <MicOff className="size-3.5" />;
}

function renderMessageList({
  messages,
  showInitialLoadingState,
  t,
  currentUser,
}: {
  messages: AiInterviewMessage[];
  showInitialLoadingState: boolean;
  t: (key: string) => string;
  currentUser: Participant | null;
}): ReactNode {
  if (showInitialLoadingState) {
    return (
      <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 px-3 py-3">
        <div className="flex items-center gap-2 text-xs text-primary">
          <Loader2 className="size-3.5 animate-spin" />
          <span>{t('workspace.aiInterviewBusy')}</span>
        </div>
      </div>
    );
  }
  if (messages.length === 0) {
    return (
      <p className="pt-4 text-center text-xs text-muted-foreground">
        {t('workspace.aiInterviewEmpty')}
      </p>
    );
  }
  return messages.map((msg, index) => (
    <AiInterviewMessageBubble
      key={msg.id ?? `${msg.role}-${index}-${msg.content.slice(0, 20)}`}
      message={msg}
      t={t}
      currentUser={currentUser}
    />
  ));
}

export function isVoiceCaptureStateActive(state: VoiceCaptureState): boolean {
  switch (state) {
    case 'requesting':
    case 'listening':
    case 'transcribing':
    case 'responding':
      return true;
    default:
      return false;
  }
}

export function resolveVoiceButtonTitle(
  t: (key: string) => string,
  isVoiceInputSupported: boolean,
): string {
  if (isVoiceInputSupported) {
    return t('workspace.aiInterviewVoiceInput');
  }
  return t('workspace.aiInterviewVoiceUnsupported');
}

export function shouldShowSendingIndicator(
  isLoading: boolean,
  showInitialLoadingState: boolean,
): boolean {
  if (!isLoading) {
    return false;
  }
  return !showInitialLoadingState;
}

function renderSendingIndicator({
  show,
  t,
}: {
  show: boolean;
  t: (key: string) => string;
}): ReactNode {
  if (!show) {
    return null;
  }
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Bot className="size-3 shrink-0 animate-pulse text-primary" />
      <span className="animate-pulse">{t('workspace.aiInterviewSending')}</span>
    </div>
  );
}

function renderErrorBanner(error: string | null): ReactNode {
  if (!error) {
    return null;
  }
  return <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>;
}

function supportsVoiceInput(
  onTranscribeVoiceInput: ((request: VoiceTranscriptionRequest) => Promise<string>) | undefined,
): boolean {
  if (!onTranscribeVoiceInput) {
    return false;
  }
  return supportsMediaRecorderAndCapture();
}

function isInitialLoadingState(isLoading: boolean, messageCount: number): boolean {
  if (!isLoading) {
    return false;
  }
  return messageCount === 0;
}

function renderComposerArea({
  isVoiceCaptureActive,
  voiceLevel,
  isListening,
  isAssistantResponding,
  voiceStatusText,
  isTranscribingVoice,
  draft,
  canSendMessage,
  isLoading,
  voiceError,
  isVoiceInputSupported,
  onDraftChange,
  onKeyDown,
  onSend,
  onToggleVoiceInput,
  isRequestingVoice,
  voiceButtonTitle,
  t,
}: {
  isVoiceCaptureActive: boolean;
  voiceLevel: number;
  isListening: boolean;
  isAssistantResponding: boolean;
  voiceStatusText: string | null;
  isTranscribingVoice: boolean;
  draft: string;
  canSendMessage: boolean;
  isLoading: boolean;
  voiceError: string | null;
  isVoiceInputSupported: boolean;
  onDraftChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onToggleVoiceInput: () => void;
  isRequestingVoice: boolean;
  voiceButtonTitle: string;
  t: (key: string) => string;
}): ReactNode {
  let voiceStatusToneClass: string;
  if (isTranscribingVoice) {
    voiceStatusToneClass = 'text-muted-foreground';
  } else if (isAssistantResponding) {
    voiceStatusToneClass = 'text-sky-300';
  } else {
    voiceStatusToneClass = 'text-primary';
  }
  return (
    <div className="space-y-2 border-t border-border p-3">
      {isVoiceCaptureActive ? (
        <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-3">
          <VoiceActivityWave
            level={voiceLevel}
            active={isListening || isAssistantResponding}
            tone={isAssistantResponding ? 'assistant' : 'user'}
          />
          {voiceStatusText ? (
            <p className={`text-xs ${voiceStatusToneClass}`}>{voiceStatusText}</p>
          ) : null}
        </div>
      ) : (
        <textarea
          value={draft}
          onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => {
            onDraftChange(event.target.value);
          }}
          onKeyDown={onKeyDown}
          placeholder={t('workspace.aiInterviewPlaceholder')}
          disabled={!canSendMessage || isLoading}
          maxLength={2000}
          rows={3}
          className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
        />
      )}
      {voiceError ? <p className="text-xs text-destructive">{voiceError}</p> : null}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 gap-1.5"
          disabled={!canSendMessage || !isVoiceInputSupported}
          onClick={onToggleVoiceInput}
          aria-pressed={isVoiceCaptureActive}
          title={voiceButtonTitle}
        >
          {renderVoiceInputIcon({
            isListening,
            isRequestingVoice,
            isTranscribingVoice,
            isAssistantResponding,
          })}
          <span className="sr-only">{t('workspace.aiInterviewVoiceInput')}</span>
        </Button>
        <Button
          size="sm"
          className="min-w-0 flex-1 gap-1.5"
          disabled={!draft.trim() || !canSendMessage || isLoading || isVoiceCaptureActive}
          onClick={onSend}
        >
          <Send className="size-3.5 shrink-0" />
          {isLoading ? t('workspace.aiInterviewSending') : t('workspace.aiInterviewSend')}
        </Button>
      </div>
    </div>
  );
}

export function RoomAiInterviewPanel({
  mode = 'legacy',
  realtimeAgentState = 'idle',
  realtimeUserState = 'listening',
  realtimeInterruptionAt = null,
  messages,
  isLoading,
  error,
  onSendMessage,
  canSendMessage,
  currentUser,
  onTranscribeVoiceInput,
}: {
  mode?: AiInterviewPanelMode;
  realtimeAgentState?: 'initializing' | 'idle' | 'listening' | 'thinking' | 'speaking';
  realtimeUserState?: 'speaking' | 'listening' | 'away';
  realtimeInterruptionAt?: number | null;
  messages: AiInterviewMessage[];
  isLoading: boolean;
  error: string | null;
  onSendMessage: (message: string) => boolean | undefined;
  canSendMessage: boolean;
  currentUser: Participant | null;
  onTranscribeVoiceInput?: (request: VoiceTranscriptionRequest) => Promise<string>;
}) {
  const { t, i18n } = useTranslation('rooms');
  const isRealtimeMode = mode === 'realtime';
  const [draft, setDraft] = useState('');
  const [voiceCaptureState, setVoiceCaptureState] = useState<VoiceCaptureState>('idle');
  const [voiceConversationEnabled, setVoiceConversationEnabled] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaChunksRef = useRef<BlobPart[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const analyserDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const analyserAnimationFrameRef = useRef<number | null>(null);
  const voiceStopFallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceActiveAtRef = useRef(0);
  const voiceStartedAtRef = useRef(0);
  const voiceAutoStopPendingRef = useRef(false);
  const voiceDetectedSpeechRef = useRef(false);
  const voiceInterruptionAtRef = useRef<number | null>(null);
  const voiceInterruptionHandledRef = useRef(false);
  const voiceSessionRef = useRef(0);
  const voiceFinalizedSessionRef = useRef<number | null>(null);
  const voiceRestartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceCaptureStateRef = useRef<VoiceCaptureState>('idle');
  const voiceConversationEnabledRef = useRef(false);
  const lastSpokenAssistantMessageIdRef = useRef<string | null>(null);
  const startVoiceCaptureRef = useRef<() => Promise<void>>(async () => {});
  const isUnmountedRef = useRef(false);
  const voiceTimeoutMessage = t('workspace.aiInterviewVoiceTimeout');
  const isDevEnvironment =
    (import.meta as ImportMeta & { env?: Record<string, unknown> }).env?.DEV === true;
  const isVoiceInputSupported = !isRealtimeMode && supportsVoiceInput(onTranscribeVoiceInput);
  const isListening = voiceCaptureState === 'listening';
  const isRequestingVoice = voiceCaptureState === 'requesting';
  const isTranscribingVoice = voiceCaptureState === 'transcribing';
  const isAssistantResponding = voiceCaptureState === 'responding';
  const isVoiceCaptureActive =
    voiceConversationEnabled || isVoiceCaptureStateActive(voiceCaptureState);

  const voiceStatusText = resolveVoiceStatusText(t, voiceCaptureState);

  const messageCount = messages.length;
  const showInitialLoadingState = isInitialLoadingState(isLoading, messageCount);
  const showSendingIndicator = shouldShowSendingIndicator(isLoading, showInitialLoadingState);
  const voiceButtonTitle = voiceConversationEnabled
    ? t('workspace.aiInterviewVoiceStop')
    : resolveVoiceButtonTitle(t, isVoiceInputSupported);
  const latestAssistantMessage = resolveLatestAssistantMessage(messages);

  const clearVoiceRestartTimeout = useCallback(() => {
    if (voiceRestartTimeoutRef.current != null) {
      clearTimeout(voiceRestartTimeoutRef.current);
      voiceRestartTimeoutRef.current = null;
    }
  }, []);

  const stopAssistantPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const speechSynthesisApi = globalThis.speechSynthesis;
    if (speechSynthesisApi) {
      speechSynthesisApi.cancel();
    }
    speechUtteranceRef.current = null;
    if (!isUnmountedRef.current) {
      setVoiceCaptureState((previous) => (previous === 'responding' ? 'idle' : previous));
    }
  }, []);

  const scheduleVoiceCaptureRestart = useCallback(() => {
    clearVoiceRestartTimeout();
    voiceRestartTimeoutRef.current = globalThis.setTimeout(() => {
      voiceRestartTimeoutRef.current = null;
      if (isUnmountedRef.current || !voiceConversationEnabledRef.current) {
        return;
      }
      if (voiceCaptureStateRef.current !== 'idle') {
        return;
      }
      void startVoiceCaptureRef.current();
    }, VOICE_AUTO_RESTART_DELAY_MS);
  }, [clearVoiceRestartTimeout]);

  const speakWithSpeechSynthesis = useCallback(
    async (text: string): Promise<void> => {
      const speechSynthesisApi = globalThis.speechSynthesis;
      const SpeechSynthesisUtteranceCtor = globalThis.SpeechSynthesisUtterance;
      if (!speechSynthesisApi || !SpeechSynthesisUtteranceCtor) {
        return;
      }

      speechSynthesisApi.cancel();
      const locale = resolveAssistantSpeechLocale(text, i18n.language);
      const utterances = splitSpeechUtterance(text);

      for (const phrase of utterances) {
        await new Promise<void>((resolve, reject) => {
          const utterance = new SpeechSynthesisUtteranceCtor(phrase);
          const voices = speechSynthesisApi.getVoices();
          const selectedVoice = pickSpeechSynthesisVoice(voices, locale);
          if (selectedVoice) {
            utterance.voice = selectedVoice;
          }
          utterance.lang = locale;
          utterance.rate = 1;
          utterance.pitch = 1;
          utterance.onend = () => resolve();
          utterance.onerror = () => reject(new Error('Speech synthesis playback failed'));
          speechUtteranceRef.current = utterance;
          speechSynthesisApi.speak(utterance);
        });
      }

      speechUtteranceRef.current = null;
    },
    [i18n.language],
  );

  const playAssistantMessage = useCallback(
    async (message: AiInterviewMessage): Promise<void> => {
      const spokenText = buildAssistantSpeechText(message);
      if (!spokenText) {
        return;
      }

      setVoiceCaptureState('responding');
      setVoiceLevel(0);
      voiceInterruptionAtRef.current = null;
      voiceInterruptionHandledRef.current = false;

      const finalize = () => {
        if (isUnmountedRef.current) {
          return;
        }
        setVoiceCaptureState((previous) => (previous === 'responding' ? 'idle' : previous));
        if (voiceConversationEnabledRef.current) {
          scheduleVoiceCaptureRestart();
        }
      };

      if (message.audioUrl) {
        try {
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
          }
          const audio = new Audio(message.audioUrl);
          audioRef.current = audio;
          await new Promise<void>((resolve, reject) => {
            audio.onended = () => resolve();
            audio.onerror = () => reject(new Error('Remote audio playback failed'));
            void audio.play().catch(reject);
          });
          finalize();
          return;
        } catch {
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
          }
        }
      }

      try {
        await speakWithSpeechSynthesis(spokenText);
      } finally {
        finalize();
      }
    },
    [scheduleVoiceCaptureRestart, speakWithSpeechSynthesis],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messageCount]);

  useEffect(() => {
    voiceCaptureStateRef.current = voiceCaptureState;
  }, [voiceCaptureState]);

  useEffect(() => {
    voiceConversationEnabledRef.current = voiceConversationEnabled;
  }, [voiceConversationEnabled]);

  useEffect(() => {
    if (voiceConversationEnabled) {
      return;
    }
    stopAssistantPlayback();
    clearVoiceRestartTimeout();
  }, [clearVoiceRestartTimeout, stopAssistantPlayback, voiceConversationEnabled]);

  useEffect(() => {
    if (!voiceConversationEnabled || !latestAssistantMessage) {
      return;
    }
    if (latestAssistantMessage.stableId === lastSpokenAssistantMessageIdRef.current) {
      return;
    }
    lastSpokenAssistantMessageIdRef.current = latestAssistantMessage.stableId;
    void playAssistantMessage(latestAssistantMessage.message);
  }, [latestAssistantMessage, playAssistantMessage, voiceConversationEnabled]);

  useEffect(() => {
    isUnmountedRef.current = false;
    return () => {
      isUnmountedRef.current = true;
      voiceSessionRef.current += 1;
      clearVoiceRestartTimeout();
      if (voiceStopFallbackTimeoutRef.current != null) {
        clearTimeout(voiceStopFallbackTimeoutRef.current);
        voiceStopFallbackTimeoutRef.current = null;
      }
      stopAssistantPlayback();
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      }
      mediaRecorderRef.current = null;
      stopMediaStream(mediaStreamRef.current);
      mediaStreamRef.current = null;
      if (analyserAnimationFrameRef.current != null) {
        cancelAnimationFrame(analyserAnimationFrameRef.current);
        analyserAnimationFrameRef.current = null;
      }
      analyserRef.current = null;
      analyserDataRef.current = null;
      if (audioContextRef.current) {
        void audioContextRef.current.close().catch(() => undefined);
        audioContextRef.current = null;
      }
    };
  }, [clearVoiceRestartTimeout, stopAssistantPlayback]);

  function handleSend() {
    const trimmed = draft.trim();
    if (!trimmed || isLoading) return;
    stopAssistantPlayback();
    const accepted = onSendMessage(trimmed);
    if (accepted === false) {
      return;
    }
    setDraft('');
  }

  const stopAudioMeter = useCallback(() => {
    if (analyserAnimationFrameRef.current != null) {
      cancelAnimationFrame(analyserAnimationFrameRef.current);
      analyserAnimationFrameRef.current = null;
    }

    analyserRef.current = null;
    analyserDataRef.current = null;

    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    setVoiceLevel(0);
  }, []);

  const cancelVoiceStopFallback = useCallback(() => {
    if (voiceStopFallbackTimeoutRef.current != null) {
      clearTimeout(voiceStopFallbackTimeoutRef.current);
      voiceStopFallbackTimeoutRef.current = null;
    }
  }, []);

  const stopVoiceStreamsAndMeter = useCallback(() => {
    stopMediaStream(mediaStreamRef.current);
    mediaStreamRef.current = null;
    stopAudioMeter();
  }, [stopAudioMeter]);

  const logVoice = useCallback(
    (event: string, details?: Record<string, unknown>) => {
      if (!isDevEnvironment) {
        return;
      }
      if (details) {
        console.debug('[ai-interview-voice]', event, details);
        return;
      }
      console.debug('[ai-interview-voice]', event);
    },
    [isDevEnvironment],
  );

  useEffect(() => {
    if (voiceCaptureState !== 'transcribing') {
      return;
    }
    const timeoutId = globalThis.setTimeout(
      () => {
        if (isUnmountedRef.current || voiceCaptureState !== 'transcribing') {
          return;
        }
        voiceSessionRef.current += 1;
        mediaRecorderRef.current = null;
        mediaChunksRef.current = [];
        cancelVoiceStopFallback();
        stopVoiceStreamsAndMeter();
        setVoiceCaptureState('idle');
        setVoiceError(voiceTimeoutMessage);
      },
      VOICE_TRANSCRIPTION_TIMEOUT_MS + VOICE_BASE64_ENCODE_TIMEOUT_MS + 3_000,
    );

    return () => {
      clearTimeout(timeoutId);
    };
  }, [voiceCaptureState, voiceTimeoutMessage, cancelVoiceStopFallback, stopVoiceStreamsAndMeter]);

  function maybeAutoStopOnSilence(requestId: number) {
    if (voiceSessionRef.current !== requestId || voiceAutoStopPendingRef.current) {
      return;
    }
    const now = Date.now();
    if (now - voiceStartedAtRef.current < VOICE_RECORDING_MIN_MS) {
      return;
    }
    if (now - voiceStartedAtRef.current >= VOICE_MAX_RECORDING_MS) {
      stopVoiceCapture(requestId, {
        transcribe: voiceDetectedSpeechRef.current,
      });
      if (!voiceDetectedSpeechRef.current && voiceConversationEnabledRef.current) {
        scheduleVoiceCaptureRestart();
      }
      return;
    }
    if (!voiceDetectedSpeechRef.current) {
      return;
    }
    if (now - voiceActiveAtRef.current < VOICE_SILENCE_AUTO_STOP_MS) {
      return;
    }
    voiceAutoStopPendingRef.current = true;
    stopVoiceCapture(requestId, { transcribe: true });
  }

  function monitorVoiceLevels(requestId: number) {
    const analyser = analyserRef.current;
    const data = analyserDataRef.current;
    if (!analyser || !data || voiceSessionRef.current !== requestId) {
      return;
    }

    analyser.getByteTimeDomainData(data);
    let sumSquares = 0;
    for (const sample of data) {
      const centered = (sample - 128) / 128;
      sumSquares += centered * centered;
    }
    const rms = Math.sqrt(sumSquares / data.length);

    if (rms >= VOICE_ACTIVITY_THRESHOLD) {
      voiceActiveAtRef.current = Date.now();
      voiceAutoStopPendingRef.current = false;
      voiceDetectedSpeechRef.current = true;
    }

    if (voiceCaptureStateRef.current === 'responding' && voiceConversationEnabledRef.current) {
      if (rms >= VOICE_INTERRUPTION_THRESHOLD) {
        if (voiceInterruptionAtRef.current == null) {
          voiceInterruptionAtRef.current = Date.now();
        } else if (
          !voiceInterruptionHandledRef.current &&
          Date.now() - voiceInterruptionAtRef.current >= VOICE_INTERRUPTION_HOLD_MS
        ) {
          voiceInterruptionHandledRef.current = true;
          stopAssistantPlayback();
          setVoiceCaptureState('listening');
          voiceActiveAtRef.current = Date.now();
        }
      } else {
        voiceInterruptionAtRef.current = null;
        voiceInterruptionHandledRef.current = false;
      }
    }

    const normalizedLevel = Math.min(1, rms / 0.18);
    setVoiceLevel((previous) => previous * 0.7 + normalizedLevel * 0.3);
    maybeAutoStopOnSilence(requestId);
    analyserAnimationFrameRef.current = requestAnimationFrame(() => monitorVoiceLevels(requestId));
  }

  function startVoiceMeter(stream: MediaStream, requestId: number) {
    const AudioContextCtor =
      globalThis.AudioContext ??
      (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    try {
      const context = new AudioContextCtor();
      if (context.state === 'suspended') {
        void context.resume().catch(() => undefined);
      }
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = context;
      analyserRef.current = analyser;
      analyserDataRef.current = new Uint8Array(analyser.fftSize);
      analyserAnimationFrameRef.current = requestAnimationFrame(() =>
        monitorVoiceLevels(requestId),
      );
    } catch {
      stopAudioMeter();
    }
  }

  const finalizeVoiceCapture = useCallback(
    async (requestId: number, recordedBlob: Blob) => {
      if (
        isUnmountedRef.current ||
        voiceSessionRef.current !== requestId ||
        !onTranscribeVoiceInput
      ) {
        return;
      }

      if (recordedBlob.size === 0) {
        setVoiceCaptureState('idle');
        setVoiceError(t('workspace.aiInterviewVoiceNoSpeech'));
        if (voiceConversationEnabledRef.current) {
          scheduleVoiceCaptureRestart();
        }
        return;
      }
      if (recordedBlob.size > VOICE_MAX_BLOB_BYTES) {
        setVoiceCaptureState('idle');
        setVoiceError(t('workspace.aiInterviewVoiceTooLong'));
        if (voiceConversationEnabledRef.current) {
          scheduleVoiceCaptureRestart();
        }
        return;
      }

      try {
        setVoiceCaptureState('transcribing');
        const preparedAudio = await withTimeout(
          prepareVoiceAudioForTranscription(recordedBlob),
          VOICE_AUDIO_PREPARE_TIMEOUT_MS,
          () => new Error(voiceTimeoutMessage),
        );
        logVoice('prepare-audio-done', {
          requestId,
          sourceSize: recordedBlob.size,
          sourceType: recordedBlob.type,
          preparedSize: preparedAudio.blob.size,
          preparedType: preparedAudio.mimeType,
        });
        if (preparedAudio.blob.size > VOICE_MAX_BLOB_BYTES) {
          setVoiceCaptureState('idle');
          setVoiceError(t('workspace.aiInterviewVoiceTooLong'));
          if (voiceConversationEnabledRef.current) {
            scheduleVoiceCaptureRestart();
          }
          return;
        }

        logVoice('encode-start', {
          requestId,
          size: preparedAudio.blob.size,
          type: preparedAudio.mimeType,
        });
        const audioBase64 = await withTimeout(
          blobToBase64(preparedAudio.blob),
          VOICE_BASE64_ENCODE_TIMEOUT_MS,
          () => new Error(voiceTimeoutMessage),
        );
        logVoice('encode-done', {
          requestId,
          base64Length: audioBase64.length,
        });
        if (voiceSessionRef.current !== requestId || isUnmountedRef.current) {
          return;
        }

        logVoice('transcribe-start', { requestId });
        const transcript = await withTimeout(
          onTranscribeVoiceInput({
            audioBase64,
            mimeType: preparedAudio.mimeType,
            language: resolveRecognitionLanguage(i18n.language),
          }),
          VOICE_TRANSCRIPTION_TIMEOUT_MS,
          () => new Error(voiceTimeoutMessage),
        );
        logVoice('transcribe-done', {
          requestId,
          transcriptLength: transcript.length,
        });

        if (voiceSessionRef.current !== requestId || isUnmountedRef.current) {
          return;
        }

        const normalized = transcript.trim();
        if (!normalized) {
          setVoiceError(t('workspace.aiInterviewVoiceNoSpeech'));
          setVoiceCaptureState('idle');
          if (voiceConversationEnabledRef.current) {
            scheduleVoiceCaptureRestart();
          }
          return;
        }

        onSendMessage(normalized);
        setDraft('');
        setVoiceCaptureState('idle');
        if (voiceConversationEnabledRef.current) {
          scheduleVoiceCaptureRestart();
        }
      } catch (error) {
        logVoice('finalize-error', {
          requestId,
          error,
        });
        if (voiceSessionRef.current !== requestId || isUnmountedRef.current) {
          return;
        }
        const message =
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : t('workspace.aiInterviewVoiceNetworkError');
        setVoiceError(message);
        setVoiceCaptureState('idle');
        if (voiceConversationEnabledRef.current) {
          scheduleVoiceCaptureRestart();
        }
      }
    },
    [
      i18n.language,
      logVoice,
      onSendMessage,
      onTranscribeVoiceInput,
      scheduleVoiceCaptureRestart,
      t,
      voiceTimeoutMessage,
    ],
  );

  const finalizeVoiceCaptureFromChunks = useCallback(
    (requestId: number, fallbackMimeType?: string) => {
      if (voiceFinalizedSessionRef.current === requestId) {
        return;
      }
      voiceFinalizedSessionRef.current = requestId;
      cancelVoiceStopFallback();

      const recorder = mediaRecorderRef.current;
      const recordedBlob = new Blob(mediaChunksRef.current, {
        type: recorder?.mimeType || fallbackMimeType || 'audio/webm',
      });
      mediaChunksRef.current = [];
      mediaRecorderRef.current = null;
      stopVoiceStreamsAndMeter();
      logVoice('finalize-from-chunks', {
        requestId,
        size: recordedBlob.size,
        type: recordedBlob.type,
      });
      void finalizeVoiceCapture(requestId, recordedBlob);
    },
    [cancelVoiceStopFallback, finalizeVoiceCapture, logVoice, stopVoiceStreamsAndMeter],
  );

  function stopVoiceCapture(
    expectedRequestId: number,
    options: Readonly<{ transcribe: boolean }> = STOP_VOICE_CAPTURE_DEFAULT_OPTIONS,
  ) {
    if (voiceSessionRef.current !== expectedRequestId) {
      return;
    }

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setVoiceCaptureState('idle');
      stopVoiceStreamsAndMeter();
      return;
    }

    if (!options.transcribe) {
      cancelVoiceStopFallback();
      stopVoiceStreamsAndMeter();
      mediaRecorderRef.current = null;
      mediaChunksRef.current = [];
      setVoiceCaptureState('idle');
      try {
        recorder.stop();
      } catch {}
      return;
    }

    setVoiceCaptureState('transcribing');
    cancelVoiceStopFallback();
    logVoice('stop-capture', {
      requestId: expectedRequestId,
      recorderState: recorder.state,
      bufferedChunks: mediaChunksRef.current.length,
    });
    try {
      recorder.requestData();
    } catch {}
    stopVoiceStreamsAndMeter();
    voiceStopFallbackTimeoutRef.current = globalThis.setTimeout(() => {
      if (voiceSessionRef.current !== expectedRequestId || isUnmountedRef.current) {
        return;
      }
      finalizeVoiceCaptureFromChunks(expectedRequestId, recorder.mimeType);
    }, VOICE_STOP_FALLBACK_MS);
    try {
      recorder.stop();
    } catch {
      finalizeVoiceCaptureFromChunks(expectedRequestId, recorder.mimeType);
    }
  }

  async function startVoiceCapture() {
    if (!isVoiceInputSupported || !onTranscribeVoiceInput) {
      setVoiceError(t('workspace.aiInterviewVoiceUnsupported'));
      return;
    }

    const requestId = voiceSessionRef.current + 1;
    voiceSessionRef.current = requestId;
    voiceFinalizedSessionRef.current = null;
    voiceAutoStopPendingRef.current = false;
    voiceDetectedSpeechRef.current = false;
    voiceInterruptionAtRef.current = null;
    voiceInterruptionHandledRef.current = false;
    mediaChunksRef.current = [];
    cancelVoiceStopFallback();
    setVoiceError(null);
    setVoiceCaptureState('requesting');
    setVoiceLevel(0);

    const capture = await requestMicrophoneStream();
    if (voiceSessionRef.current !== requestId) {
      stopMediaStream(capture.stream);
      return;
    }
    if (capture.result !== 'granted' || !capture.stream) {
      setVoiceCaptureState('idle');
      setVoiceError(resolveVoicePermissionError(t, capture.result));
      stopMediaStream(capture.stream);
      return;
    }

    try {
      const stream = capture.stream;
      mediaStreamRef.current = stream;
      const mimeType = pickRecordingMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          mediaChunksRef.current.push(event.data);
          voiceDetectedSpeechRef.current = true;
          logVoice('data-available', {
            requestId,
            chunkSize: event.data.size,
            chunkCount: mediaChunksRef.current.length,
          });
        }
      };

      recorder.onerror = () => {
        if (voiceSessionRef.current !== requestId) {
          return;
        }
        stopVoiceStreamsAndMeter();
        mediaRecorderRef.current = null;
        mediaChunksRef.current = [];
        setVoiceCaptureState('idle');
        setVoiceError(t('workspace.aiInterviewVoiceError'));
      };

      recorder.onstop = () => {
        cancelVoiceStopFallback();
        logVoice('recorder-stop', {
          requestId,
          chunkCount: mediaChunksRef.current.length,
          currentSession: voiceSessionRef.current,
          unmounted: isUnmountedRef.current,
        });
        if (voiceSessionRef.current !== requestId) {
          stopVoiceStreamsAndMeter();
          mediaRecorderRef.current = null;
          mediaChunksRef.current = [];
          return;
        }
        finalizeVoiceCaptureFromChunks(requestId, recorder.mimeType || mimeType || 'audio/webm');
      };

      voiceStartedAtRef.current = Date.now();
      voiceActiveAtRef.current = Date.now();
      recorder.start(VOICE_RECORDER_TIMESLICE_MS);
      startVoiceMeter(stream, requestId);
      setVoiceCaptureState('listening');
      logVoice('capture-started', {
        requestId,
        mimeType: recorder.mimeType || mimeType || 'audio/webm',
      });
    } catch {
      stopVoiceStreamsAndMeter();
      mediaRecorderRef.current = null;
      mediaChunksRef.current = [];
      cancelVoiceStopFallback();
      setVoiceCaptureState('idle');
      setVoiceError(t('workspace.aiInterviewVoiceError'));
    }
  }

  startVoiceCaptureRef.current = startVoiceCapture;

  async function toggleVoiceInput() {
    if (voiceConversationEnabledRef.current) {
      setVoiceConversationEnabled(false);
      clearVoiceRestartTimeout();
      stopAssistantPlayback();
      const requestId = voiceSessionRef.current;
      const recorder = mediaRecorderRef.current;
      const shouldTranscribeCurrentCapture =
        recorder?.state === 'recording' && voiceCaptureStateRef.current !== 'transcribing';
      if (shouldTranscribeCurrentCapture) {
        stopVoiceCapture(requestId, { transcribe: true });
      } else {
        voiceSessionRef.current += 1;
        stopVoiceCapture(requestId, { transcribe: false });
        setVoiceCaptureState('idle');
      }
      return;
    }

    setVoiceConversationEnabled(true);
    await startVoiceCapture();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (isRealtimeMode) {
    const realtimeStatusText = resolveRealtimeAgentStatusText(
      t,
      realtimeAgentState,
      realtimeUserState,
    );
    const realtimeWaveTone: 'assistant' | 'user' =
      realtimeAgentState === 'speaking' ? 'assistant' : 'user';
    let realtimeWaveLevel = 0.2;
    if (realtimeAgentState === 'speaking') {
      realtimeWaveLevel = 0.9;
    } else if (realtimeUserState === 'speaking') {
      realtimeWaveLevel = 0.7;
    } else if (realtimeAgentState === 'thinking') {
      realtimeWaveLevel = 0.35;
    }
    const showInterruptionNotice = realtimeInterruptionAt != null;

    return (
      <div className="flex h-full flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
            <p className="text-xs text-primary">{t('workspace.aiInterviewRealtimeConnected')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{realtimeStatusText}</p>
          </div>
          <div className="rounded-md border border-primary/25 bg-primary/5 px-3 py-3">
            <VoiceActivityWave level={realtimeWaveLevel} active={true} tone={realtimeWaveTone} />
            {showInterruptionNotice ? (
              <p className="mt-1 text-xs text-primary">
                {t('workspace.aiInterviewRealtimeInterruption')}
              </p>
            ) : null}
          </div>
          <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              {t('workspace.aiInterviewRealtimeVoiceOnly')}
            </p>
          </div>
          {showInitialLoadingState ? (
            <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-3">
              <div className="flex items-center gap-2 text-xs text-primary">
                <Loader2 className="size-3.5 animate-spin" />
                <span>{t('workspace.aiInterviewBusy')}</span>
              </div>
            </div>
          ) : null}
          {renderErrorBanner(error)}
          <div ref={bottomRef} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {renderMessageList({ messages, showInitialLoadingState, t, currentUser })}
        {renderSendingIndicator({ show: showSendingIndicator, t })}
        {renderErrorBanner(error)}
        <div ref={bottomRef} />
      </div>

      {renderComposerArea({
        isVoiceCaptureActive,
        voiceLevel,
        isListening,
        isAssistantResponding,
        voiceStatusText,
        isTranscribingVoice,
        draft,
        canSendMessage,
        isLoading,
        voiceError,
        isVoiceInputSupported,
        onDraftChange: setDraft,
        onKeyDown: handleKeyDown,
        onSend: handleSend,
        onToggleVoiceInput: () => {
          void toggleVoiceInput();
        },
        isRequestingVoice,
        voiceButtonTitle,
        t,
      })}
    </div>
  );
}

function VoiceActivityWave({
  level,
  active,
  tone,
}: Readonly<{
  level: number;
  active: boolean;
  tone: 'user' | 'assistant';
}>) {
  const center = VOICE_WAVE_OFFSETS.length / 2;

  return (
    <div className="flex h-12 items-end justify-center gap-1" aria-hidden="true">
      {VOICE_WAVE_OFFSETS.map((offset) => {
        const distance = Math.abs(offset) / center;
        const shape = 1 - distance;
        const dynamic = active ? level * (10 + shape * 28) : 4;
        const height = Math.max(4, Math.round(4 + shape * 14 + dynamic));

        return (
          <span
            key={`wave-${offset}`}
            className={`w-1.5 rounded-full transition-[height] duration-100 ease-out ${
              tone === 'assistant' ? 'bg-sky-300/80' : 'bg-primary/70'
            }`}
            style={{ height }}
          />
        );
      })}
    </div>
  );
}

function AiInterviewMessageBubble({
  message,
  t,
  currentUser,
}: {
  message: AiInterviewMessage;
  t: (key: string) => string;
  currentUser: Participant | null;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className="mt-0.5 shrink-0">
        {isUser ? (
          <Avatar className="size-6 text-[9px]">
            {currentUser?.avatarUrl ? <AvatarImage src={currentUser.avatarUrl} /> : null}
            <AvatarFallback className="bg-primary/20 text-primary">
              {(currentUser?.displayName ?? currentUser?.username ?? '?').charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="flex size-6 items-center justify-center rounded-full bg-muted">
            <Bot className="size-3 text-muted-foreground" />
          </div>
        )}
      </div>

      <div
        className={`flex max-w-[85%] flex-col space-y-1.5 ${isUser ? 'items-end' : 'items-start'}`}
      >
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {isUser ? t('workspace.aiInterviewYou') : t('workspace.aiInterviewAi')}
        </p>
        <div
          className={`rounded-xl px-3 py-2 text-sm leading-6 ${
            isUser
              ? 'bg-primary/15 text-foreground'
              : 'bg-muted/60 text-foreground ring-1 ring-border/50'
          }`}
        >
          {message.content}
        </div>

        {message.followUpQuestion ? (
          <div className="rounded-xl bg-primary/5 px-3 py-2 text-sm leading-6 ring-1 ring-primary/20">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-primary/70">
              {t('workspace.aiInterviewFollowUp')}
            </p>
            {message.followUpQuestion}
          </div>
        ) : null}

        {message.codeContext ? (
          <AiInterviewCodeContextCard context={message.codeContext} t={t} />
        ) : null}

        {message.codeAnnotations?.length ? (
          <div className="w-full rounded-xl bg-muted/40 px-3 py-2 ring-1 ring-border/40">
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {t('workspace.aiInterviewAnnotations')}
            </p>
            <ul className="space-y-1">
              {message.codeAnnotations.map((annotation) => (
                <li
                  key={`L${annotation.line}-${annotation.comment.slice(0, 20)}`}
                  className="flex gap-2 text-xs text-muted-foreground"
                >
                  <span className="shrink-0 font-mono text-primary/70">L{annotation.line}</span>
                  <div className="min-w-0 flex-1 text-xs">
                    <InlineCommentMarkdown markdown={annotation.comment} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AiInterviewCodeContextCard({
  context,
  t,
}: Readonly<{
  context: AiInterviewCodeContext;
  t: (key: string, options?: Record<string, unknown>) => string;
}>) {
  return (
    <div className="w-full overflow-hidden rounded-xl bg-background/70 ring-1 ring-border/50">
      <div className="flex items-center justify-between gap-2 border-b border-border/50 px-3 py-2">
        <span className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {t('workspace.aiInterviewCodeContext')}
        </span>
        <span className="shrink-0 font-mono text-[10px] text-primary/75">
          {context.file} L{context.startLine}
          {context.endLine === context.startLine ? '' : `-${context.endLine}`}
        </span>
      </div>
      <pre className="max-h-32 overflow-auto px-3 py-2 font-mono text-[11px] leading-5 text-foreground/85">
        <code>{context.codeSnippet}</code>
      </pre>
      {context.questionType || context.reason ? (
        <div className="border-t border-border/50 px-3 py-2 text-xs text-muted-foreground">
          {context.questionType ? (
            <span className="font-medium text-primary/75">
              {t(`workspace.aiInterviewQuestionType.${context.questionType}`)}
            </span>
          ) : null}
          {context.reason ? (
            <span>{context.questionType ? ` - ${context.reason}` : context.reason}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function resolveRecognitionLanguage(language: string | undefined): string {
  if (!language) {
    return 'en-US';
  }

  const normalized = language.toLowerCase();
  if (normalized.startsWith('zh')) {
    return normalized.includes('tw') || normalized.includes('hk') ? 'zh-TW' : 'zh-CN';
  }
  if (normalized.startsWith('en')) {
    return 'en-US';
  }
  if (language.includes('-')) {
    return language;
  }
  // For unknown ISO 639-1 codes we leave the tag without a region: appending
  // an arbitrary region (e.g. `de-US`) yields an invalid locale that STT
  // providers may reject. The Web Speech API tolerates language-only tags.
  return language;
}

function resolveLatestAssistantMessage(
  messages: ReadonlyArray<AiInterviewMessage>,
): LatestAssistantMessage | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || message.role !== 'assistant') {
      continue;
    }
    const idPart = message.id ?? `index-${index}`;
    const createdAtPart = message.createdAt ?? 0;
    const stableId = `${idPart}:${createdAtPart}:${message.content.slice(0, 48)}`;
    return { stableId, message };
  }
  return null;
}

function buildAssistantSpeechText(message: AiInterviewMessage): string {
  const parts = [message.content.trim(), message.followUpQuestion?.trim()].filter(
    (part): part is string => Boolean(part && part.length > 0),
  );
  return parts.join(' ');
}

function containsCjkCharacters(value: string): boolean {
  return /[\u3400-\u9fff]/u.test(value);
}

function resolveAssistantSpeechLocale(text: string, uiLanguage: string): string {
  if (containsCjkCharacters(text)) {
    return 'zh-CN';
  }
  if (uiLanguage.toLowerCase().startsWith('zh')) {
    return 'zh-CN';
  }
  return 'en-US';
}

function splitSpeechUtterance(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return [];
  }

  const chunks: string[] = [];
  let buffer = '';
  const segments = normalized.split(/(?<=[。！？.!?])\s+/u);

  for (const segment of segments) {
    const next = buffer ? `${buffer} ${segment}` : segment;
    if (next.length <= VOICE_SPEECH_SYNTHESIS_CHUNK_LENGTH) {
      buffer = next;
      continue;
    }
    if (buffer) {
      chunks.push(buffer);
      buffer = '';
    }
    if (segment.length <= VOICE_SPEECH_SYNTHESIS_CHUNK_LENGTH) {
      buffer = segment;
      continue;
    }
    for (let offset = 0; offset < segment.length; offset += VOICE_SPEECH_SYNTHESIS_CHUNK_LENGTH) {
      chunks.push(segment.slice(offset, offset + VOICE_SPEECH_SYNTHESIS_CHUNK_LENGTH));
    }
  }

  if (buffer) {
    chunks.push(buffer);
  }
  return chunks;
}

function pickSpeechSynthesisVoice(
  voices: ReadonlyArray<SpeechSynthesisVoice>,
  locale: string,
): SpeechSynthesisVoice | null {
  if (voices.length === 0) {
    return null;
  }
  const normalizedLocale = locale.toLowerCase();
  const exact = voices.find((voice) => voice.lang.toLowerCase() === normalizedLocale);
  if (exact) {
    return exact;
  }
  const prefix = normalizedLocale.split('-')[0] ?? normalizedLocale;
  const sameLanguage = voices.find((voice) => voice.lang.toLowerCase().startsWith(prefix));
  return sameLanguage ?? null;
}

async function requestMicrophoneStream(): Promise<{
  result: VoicePermissionResult;
  stream: MediaStream | null;
}> {
  if (typeof navigator === 'undefined') {
    return { result: 'unavailable', stream: null };
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return { result: 'unavailable', stream: null };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return { result: 'granted', stream };
  } catch (error) {
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
        return { result: 'denied', stream: null };
      }
      if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        return { result: 'no_device', stream: null };
      }
    }
    return { result: 'unavailable', stream: null };
  }
}

function supportsMediaRecorderAndCapture(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

function stopMediaStream(stream: MediaStream | null): void {
  if (!stream) {
    return;
  }
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

function pickRecordingMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') {
    return undefined;
  }

  const preferredTypes = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'];
  for (const type of preferredTypes) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return undefined;
}

async function blobToBase64(blob: Blob): Promise<string> {
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Unable to read recorded audio.'));
      reader.onload = () => {
        if (typeof reader.result !== 'string') {
          reject(new Error('Unable to encode recorded audio.'));
          return;
        }
        const commaIndex = reader.result.indexOf(',');
        resolve(commaIndex >= 0 ? reader.result.slice(commaIndex + 1) : reader.result);
      };
      reader.readAsDataURL(blob);
    });
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  if (typeof btoa === 'undefined') {
    throw new TypeError('Base64 encoding is unavailable');
  }

  let binary = '';
  const chunkSize = 32_768;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCodePoint(...chunk);
  }
  return btoa(binary);
}

async function prepareVoiceAudioForTranscription(
  blob: Blob,
): Promise<{ blob: Blob; mimeType: string }> {
  const normalizedMimeType = normalizeTranscriptionMimeType(blob.type);
  if (normalizedMimeType === 'audio/wav') {
    return { blob, mimeType: normalizedMimeType };
  }

  const wavBlob = await convertBlobToWav(blob);
  if (wavBlob) {
    return {
      blob: wavBlob,
      mimeType: 'audio/wav',
    };
  }

  return {
    blob,
    mimeType: normalizedMimeType,
  };
}

async function convertBlobToWav(blob: Blob): Promise<Blob | null> {
  const AudioContextCtor =
    globalThis.AudioContext ??
    (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextCtor) {
    return null;
  }

  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContextCtor();
  try {
    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const mono = mixDownToMono(decoded);
    const resampled = resampleMonoData(mono, decoded.sampleRate, VOICE_TARGET_SAMPLE_RATE);
    const wav = encodeWavPcm16(resampled, VOICE_TARGET_SAMPLE_RATE);
    return new Blob([wav], { type: 'audio/wav' });
  } catch {
    return null;
  } finally {
    void audioContext.close().catch(() => undefined);
  }
}

function mixDownToMono(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) {
    return buffer.getChannelData(0).slice();
  }

  const mono = new Float32Array(buffer.length);
  for (let channelIndex = 0; channelIndex < buffer.numberOfChannels; channelIndex += 1) {
    const channelData = buffer.getChannelData(channelIndex);
    for (let sampleIndex = 0; sampleIndex < channelData.length; sampleIndex += 1) {
      mono[sampleIndex] =
        (mono[sampleIndex] ?? 0) + (channelData[sampleIndex] ?? 0) / buffer.numberOfChannels;
    }
  }
  return mono;
}

function resampleMonoData(
  input: Float32Array,
  sourceRate: number,
  targetRate: number,
): Float32Array {
  if (sourceRate === targetRate) {
    return input;
  }
  const ratio = sourceRate / targetRate;
  const outputLength = Math.max(1, Math.floor(input.length / ratio));
  const output = new Float32Array(outputLength);
  let inputIndex = 0;

  for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
    const nextInputIndex = Math.min(input.length, Math.round((outputIndex + 1) * ratio));
    let sum = 0;
    let count = 0;

    for (let index = inputIndex; index < nextInputIndex; index += 1) {
      sum += input[index] ?? 0;
      count += 1;
    }

    output[outputIndex] = count > 0 ? sum / count : (input[inputIndex] ?? 0);
    inputIndex = nextInputIndex;
  }

  return output;
}

function encodeWavPcm16(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    const pcm = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(offset, pcm, true);
    offset += bytesPerSample;
  }

  return buffer;
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.codePointAt(index) ?? 0);
  }
}

export function normalizeTranscriptionMimeType(mimeType: string | undefined): string {
  const normalized = mimeType?.split(';', 1)[0]?.trim().toLowerCase();
  if (!normalized) {
    return 'audio/webm';
  }

  if (normalized === 'audio/mp3') {
    return 'audio/mpeg';
  }

  if (normalized === 'audio/x-wav') {
    return 'audio/wav';
  }

  return normalized;
}

export function resolveVoicePermissionError(
  t: (key: string, options?: Record<string, unknown>) => string,
  result: VoicePermissionResult,
): string {
  if (result === 'denied') {
    return t('workspace.aiInterviewVoicePermissionDenied');
  }
  if (result === 'no_device') {
    return t('workspace.aiInterviewVoiceNoDevice');
  }
  return t('workspace.aiInterviewVoiceError');
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorFactory: () => Error,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(errorFactory());
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId != null) {
      clearTimeout(timeoutId);
    }
  });
}
