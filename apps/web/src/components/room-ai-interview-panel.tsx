import type { AiInterviewCodeContext } from '@syncode/contracts';
import { Avatar, AvatarFallback, AvatarImage, Button } from '@syncode/ui';
import { Bot, Mic, MicOff, Send } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
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

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
}

interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  readonly error?: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export function RoomAiInterviewPanel({
  messages,
  isLoading,
  error,
  onSendMessage,
  canSendMessage,
  currentUser,
}: {
  messages: AiInterviewMessage[];
  isLoading: boolean;
  error: string | null;
  onSendMessage: (message: string) => void;
  canSendMessage: boolean;
  currentUser: Participant | null;
}) {
  const { t } = useTranslation('rooms');
  const [draft, setDraft] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechRecognitionConstructor = resolveSpeechRecognition();

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
    return () => {
      speechRecognitionRef.current?.abort();
      speechRecognitionRef.current = null;
    };
  }, []);

  function handleSend() {
    const trimmed = draft.trim();
    if (!trimmed || isLoading) return;
    onSendMessage(trimmed);
    setDraft('');
  }

  function toggleVoiceInput() {
    if (isListening) {
      speechRecognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    if (!speechRecognitionConstructor) {
      setVoiceError(t('workspace.aiInterviewVoiceUnsupported'));
      return;
    }

    setVoiceError(null);
    const recognition = new speechRecognitionConstructor();
    speechRecognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    const baseDraft = draft;
    let finalTranscript = '';

    recognition.onresult = (event) => {
      let interimTranscript = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result) continue;
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      const transcript = `${finalTranscript}${interimTranscript}`.trim();
      if (transcript) {
        setDraft(mergeTranscript(baseDraft, transcript));
      }
    };

    recognition.onerror = () => {
      setVoiceError(t('workspace.aiInterviewVoiceError'));
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
      speechRecognitionRef.current = null;
    };

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
