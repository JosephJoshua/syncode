import type { AiInterviewCodeContext } from '@syncode/contracts';
import { Avatar, AvatarFallback, AvatarImage, Button } from '@syncode/ui';
import { Bot, Loader2, Mic, MicOff, Send } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Participant } from './room-participant-card.js';

export interface AiInterviewMessage {
  id?: string;
  createdAt?: number;
  role: 'user' | 'assistant';
  content: string;
  followUpQuestion?: string;
  codeContext?: AiInterviewCodeContext;
  codeAnnotations?: Array<{ line: number; comment: string }>;
  audioUrl?: string;
}

type VoiceCaptureState = 'idle' | 'requesting' | 'listening' | 'transcribing';
type VoicePermissionResult = 'granted' | 'denied' | 'no_device' | 'unavailable';

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
const VOICE_WAVE_OFFSETS = Array.from({ length: 21 }, (_, position) => position - 10);

export function RoomAiInterviewPanel({
  messages,
  isLoading,
  error,
  onSendMessage,
  canSendMessage,
  currentUser,
  onTranscribeVoiceInput,
}: {
  messages: AiInterviewMessage[];
  isLoading: boolean;
  error: string | null;
  onSendMessage: (message: string) => void;
  canSendMessage: boolean;
  currentUser: Participant | null;
  onTranscribeVoiceInput?: (request: VoiceTranscriptionRequest) => Promise<string>;
}) {
  const { t, i18n } = useTranslation('rooms');
  const [draft, setDraft] = useState('');
  const [voiceCaptureState, setVoiceCaptureState] = useState<VoiceCaptureState>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaChunksRef = useRef<BlobPart[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const analyserDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const analyserAnimationFrameRef = useRef<number | null>(null);
  const voiceStopFallbackTimeoutRef = useRef<number | null>(null);
  const voiceActiveAtRef = useRef(0);
  const voiceStartedAtRef = useRef(0);
  const voiceAutoStopPendingRef = useRef(false);
  const voiceSessionRef = useRef(0);
  const voiceFinalizedSessionRef = useRef<number | null>(null);
  const isUnmountedRef = useRef(false);
  const voiceTimeoutMessage = t('workspace.aiInterviewVoiceTimeout');
  const isDevEnvironment =
    (import.meta as ImportMeta & { env?: Record<string, unknown> }).env?.DEV === true;
  const isVoiceInputSupported =
    Boolean(onTranscribeVoiceInput) && supportsMediaRecorderAndCapture();
  const isListening = voiceCaptureState === 'listening';
  const isRequestingVoice = voiceCaptureState === 'requesting';
  const isTranscribingVoice = voiceCaptureState === 'transcribing';
  const isVoiceCaptureActive =
    voiceCaptureState === 'listening' ||
    voiceCaptureState === 'requesting' ||
    voiceCaptureState === 'transcribing';

  const voiceStatusText = isRequestingVoice
    ? t('workspace.aiInterviewVoiceRequesting')
    : isTranscribingVoice
      ? t('workspace.aiInterviewVoiceTranscribing')
      : isListening
        ? t('workspace.aiInterviewVoiceListening')
        : null;

  const latestAudioUrl = [...messages]
    .reverse()
    .find((m) => m.role === 'assistant' && m.audioUrl)?.audioUrl;

  const messageCount = messages.length;

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messageCount]);

  useEffect(() => {
    if (!latestAudioUrl) return;
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(latestAudioUrl);
    audioRef.current = audio;
    void audio.play().catch(() => {});
    return () => {
      audio.pause();
    };
  }, [latestAudioUrl]);

  useEffect(() => {
    isUnmountedRef.current = false;
    return () => {
      isUnmountedRef.current = true;
      voiceSessionRef.current += 1;
      if (voiceStopFallbackTimeoutRef.current != null) {
        clearTimeout(voiceStopFallbackTimeoutRef.current);
        voiceStopFallbackTimeoutRef.current = null;
      }
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
  }, []);

  function handleSend() {
    const trimmed = draft.trim();
    if (!trimmed || isLoading) return;
    onSendMessage(trimmed);
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
    const timeoutId = window.setTimeout(
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
      stopVoiceCapture(requestId);
      return;
    }
    if (now - voiceActiveAtRef.current < VOICE_SILENCE_AUTO_STOP_MS) {
      return;
    }
    voiceAutoStopPendingRef.current = true;
    stopVoiceCapture(requestId);
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
        return;
      }
      if (recordedBlob.size > VOICE_MAX_BLOB_BYTES) {
        setVoiceCaptureState('idle');
        setVoiceError(t('workspace.aiInterviewVoiceTooLong'));
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
          return;
        }

        onSendMessage(normalized);
        setDraft('');
        setVoiceCaptureState('idle');
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
      }
    },
    [i18n.language, logVoice, onSendMessage, onTranscribeVoiceInput, t, voiceTimeoutMessage],
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

  function stopVoiceCapture(expectedRequestId: number) {
    if (voiceSessionRef.current !== expectedRequestId) {
      return;
    }

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setVoiceCaptureState('idle');
      stopVoiceStreamsAndMeter();
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
    voiceStopFallbackTimeoutRef.current = window.setTimeout(() => {
      if (voiceSessionRef.current !== expectedRequestId || isUnmountedRef.current) {
        return;
      }
      finalizeVoiceCaptureFromChunks(expectedRequestId, recorder.mimeType);
    }, VOICE_STOP_FALLBACK_MS);
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      setVoiceError(t('workspace.aiInterviewVoiceError'));
      setIsListening(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <p className="pt-4 text-center text-xs text-muted-foreground">
            {t('workspace.aiInterviewEmpty')}
          </p>
        ) : (
          messages.map((msg, index) => (
            <AiInterviewMessageBubble
              key={msg.id ?? `${msg.role}-${index}-${msg.content.slice(0, 20)}`}
              message={msg}
              t={t}
              currentUser={currentUser}
            />
          ))
        )}
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Bot className="size-3 shrink-0 animate-pulse text-primary" />
            <span className="animate-pulse">{t('workspace.aiInterviewSending')}</span>
          </div>
        ) : null}
        {error ? (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <div className="space-y-2 border-t border-border p-3">
        <textarea
          value={draft}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('workspace.aiInterviewPlaceholder')}
          disabled={!canSendMessage || isLoading}
          maxLength={2000}
          rows={3}
          className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
        />
        {voiceError ? <p className="text-xs text-destructive">{voiceError}</p> : null}
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0 gap-1.5"
            disabled={!canSendMessage || isLoading || !speechRecognitionConstructor}
            onClick={toggleVoiceInput}
            aria-pressed={isListening}
            title={
              speechRecognitionConstructor
                ? t('workspace.aiInterviewVoiceInput')
                : t('workspace.aiInterviewVoiceUnsupported')
            }
          >
            {isListening ? <Mic className="size-3.5" /> : <MicOff className="size-3.5" />}
            <span className="sr-only">{t('workspace.aiInterviewVoiceInput')}</span>
          </Button>
          <Button
            size="sm"
            className="min-w-0 flex-1 gap-1.5"
            disabled={!draft.trim() || !canSendMessage || isLoading}
            onClick={handleSend}
          >
            <Send className="size-3.5 shrink-0" />
            {isLoading ? t('workspace.aiInterviewSending') : t('workspace.aiInterviewSend')}
          </Button>
        </div>
      </div>
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

        {message.codeAnnotations && message.codeAnnotations.length > 0 ? (
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
                  <span>{annotation.comment}</span>
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

function resolveSpeechRecognition(): SpeechRecognitionConstructor | null {
  const speechGlobal = globalThis as typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return speechGlobal.SpeechRecognition ?? speechGlobal.webkitSpeechRecognition ?? null;
}

function mergeTranscript(previous: string, transcript: string): string {
  if (!previous.trim()) {
    return transcript;
  }

  return `${previous.trimEnd()} ${transcript}`.trim();
}
