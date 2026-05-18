import { Button } from '@syncode/ui';
import { Bot, Send, User } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface AiInterviewMessage {
  role: 'user' | 'assistant';
  content: string;
  followUpQuestion?: string;
  codeAnnotations?: Array<{ line: number; comment: string }>;
  audioUrl?: string;
}

export function RoomAiInterviewPanel({
  messages,
  isLoading,
  error,
  onSendMessage,
  canSendMessage,
}: {
  messages: AiInterviewMessage[];
  isLoading: boolean;
  error: string | null;
  onSendMessage: (message: string) => void;
  canSendMessage: boolean;
}) {
  const { t } = useTranslation('rooms');
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  function handleSend() {
    const trimmed = draft.trim();
    if (!trimmed || isLoading) return;
    onSendMessage(trimmed);
    setDraft('');
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
              key={`${msg.role}-${index}-${msg.content.slice(0, 20)}`}
              message={msg}
              t={t}
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
        <Button
          size="sm"
          className="w-full gap-1.5"
          disabled={!draft.trim() || !canSendMessage || isLoading}
          onClick={handleSend}
        >
          <Send className="size-3.5" />
          {isLoading ? t('workspace.aiInterviewSending') : t('workspace.aiInterviewSend')}
        </Button>
      </div>
    </div>
  );
}

function AiInterviewMessageBubble({
  message,
  t,
}: {
  message: AiInterviewMessage;
  t: (key: string) => string;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className="mt-0.5 shrink-0">
        {isUser ? (
          <div className="flex size-6 items-center justify-center rounded-full bg-primary/20">
            <User className="size-3 text-primary" />
          </div>
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
