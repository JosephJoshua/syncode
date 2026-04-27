import type { ChatAttachment, ChatMessage, ChatReactToggleEventData } from '@syncode/contracts';
import { Badge, Button } from '@syncode/ui';
import { ChevronDown, Paperclip } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Participant } from './room-participant-card.js';

const REACTION_PALETTE = ['👍', '🔥', '✅', '💡'] as const;
const SCROLL_BOTTOM_THRESHOLD_PX = 24;

function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return '--:--';
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function renderMessageTextWithMentions(text: string): ReactNode[] {
  if (!text) {
    return [];
  }

  let cursor = 0;
  return text.split(/(@[a-zA-Z0-9_]+)/g).map((chunk) => {
    if (!chunk) {
      return null;
    }

    const key = `${cursor}-${chunk}`;
    cursor += chunk.length;

    if (/^@[a-zA-Z0-9_]+$/.test(chunk)) {
      return (
        <span
          key={`mention-${key}`}
          className="mx-0.5 inline-flex rounded bg-blue-500/85 px-1 py-0.5 text-[11px] font-medium text-white"
        >
          {chunk}
        </span>
      );
    }

    return <span key={`text-${key}`}>{chunk}</span>;
  });
}

interface RoomChatPanelProps {
  currentUserId: string | null;
  participants: Participant[];
  messages: ChatMessage[];
  onToggleReaction: (data: ChatReactToggleEventData) => void;
  disabled?: boolean;
  showHeader?: boolean;
  readAt?: number;
}

export function RoomChatPanel({
  currentUserId,
  participants,
  messages,
  onToggleReaction,
  disabled = false,
  showHeader = true,
  readAt = 0,
}: RoomChatPanelProps) {
  const { t } = useTranslation('rooms');
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const usersById = useMemo(() => {
    return new Map(participants.map((participant) => [participant.userId, participant]));
  }, [participants]);

  const messagesById = useMemo(() => {
    return new Map(messages.map((message) => [message.messageId, message]));
  }, [messages]);

  const isNearBottom = useCallback((element: HTMLDivElement): boolean => {
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    return distance <= SCROLL_BOTTOM_THRESHOLD_PX;
  }, []);

  const scrollToLatest = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const viewport = messagesViewportRef.current;
    if (!viewport) {
      return;
    }

    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior,
    });
    shouldStickToBottomRef.current = true;
    setShowJumpToLatest(false);
  }, []);

  const handleMessagesScroll = useCallback(() => {
    const viewport = messagesViewportRef.current;
    if (!viewport) {
      return;
    }

    const nearBottom = isNearBottom(viewport);
    shouldStickToBottomRef.current = nearBottom;
    setShowJumpToLatest(!nearBottom && messages.length > 0);
  }, [isNearBottom, messages.length]);

  useEffect(() => {
    const viewport = messagesViewportRef.current;
    if (!viewport) {
      return;
    }

    if (shouldStickToBottomRef.current) {
      scrollToLatest(messages.length <= 1 ? 'auto' : 'smooth');
      return;
    }

    setShowJumpToLatest(!isNearBottom(viewport) && messages.length > 0);
  }, [isNearBottom, messages, scrollToLatest]);

  return (
    <div className="flex h-full min-h-0 flex-col p-2">
      {showHeader ? (
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {t('workspace.chatHeading')}
          </span>
          <Badge variant="neutral" size="sm" className="text-[10px]">
            {messages.length}
          </Badge>
        </div>
      ) : (
        <div className="flex items-center justify-end">
          <Badge variant="neutral" size="sm" className="text-[10px]">
            {messages.length}
          </Badge>
        </div>
      )}

      <div className="relative mt-2 min-h-0 flex-1">
        <div
          ref={messagesViewportRef}
          onScroll={handleMessagesScroll}
          className="h-full space-y-2 overflow-y-auto rounded-md bg-background/40 p-2"
        >
          {messages.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('workspace.chatEmpty')}</p>
          ) : (
            messages.map((message) => {
              const author = usersById.get(message.userId);
              const replied = message.replyToMessageId
                ? (messagesById.get(message.replyToMessageId) ?? null)
                : null;
              const repliedAuthor = replied ? usersById.get(replied.userId) : null;
              const isOwn = message.userId === currentUserId;
              const isUnread = !isOwn && message.createdAt > readAt;

              return (
                <div
                  key={message.messageId}
                  className={`flex flex-col gap-1 ${isOwn ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3 py-2 text-xs shadow-sm ${
                      isOwn ? 'bg-primary text-primary-foreground' : 'bg-zinc-700/80 text-zinc-100'
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-2 text-[10px]">
                      <span
                        className={`truncate font-semibold ${
                          isOwn ? 'text-primary-foreground/90' : 'text-zinc-100/90'
                        }`}
                      >
                        {author?.displayName ?? author?.username ?? message.userId.slice(0, 8)}
                      </span>
                      <span
                        className={`font-mono ${
                          isOwn ? 'text-primary-foreground/70' : 'text-zinc-300/80'
                        }`}
                      >
                        {formatMessageTime(message.createdAt)}
                      </span>
                      {isUnread ? (
                        <span className="rounded-full bg-blue-500/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                          {t('workspace.chatUnreadBadge')}
                        </span>
                      ) : null}
                    </div>

                    {replied ? (
                      <div
                        className={`mb-1 rounded-lg px-2 py-1 text-[10px] ${
                          isOwn ? 'bg-primary-foreground/15' : 'bg-zinc-800/80'
                        }`}
                      >
                        <span className="font-semibold text-foreground/90">
                          {repliedAuthor?.displayName ?? repliedAuthor?.username}
                        </span>
                        {' · '}
                        <span className="line-clamp-1">
                          {replied.text || t('workspace.chatAttachmentOnly')}
                        </span>
                      </div>
                    ) : null}

                    {message.text ? (
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {renderMessageTextWithMentions(message.text)}
                      </p>
                    ) : null}

                    {message.attachments.length > 0 ? (
                      <div className="mt-1 space-y-1">
                        {message.attachments.map((attachment) => (
                          <AttachmentPreview
                            key={`${message.messageId}-${attachment.key}`}
                            attachment={attachment}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div
                    className={`flex w-full flex-wrap items-center gap-1 ${
                      isOwn ? 'justify-end pr-2' : 'justify-start pl-2'
                    }`}
                  >
                    {message.reactions.map((reaction) => {
                      const isActive = currentUserId
                        ? reaction.userIds.includes(currentUserId)
                        : false;
                      return (
                        <button
                          key={`${message.messageId}-${reaction.emoji}`}
                          type="button"
                          disabled={disabled}
                          onClick={() =>
                            onToggleReaction({
                              messageId: message.messageId,
                              emoji: reaction.emoji,
                            })
                          }
                          className={`rounded-full border px-1.5 py-0.5 text-[11px] transition-colors ${
                            disabled
                              ? 'cursor-not-allowed border-border/60 bg-background/40 text-muted-foreground'
                              : isActive
                                ? 'border-primary/50 bg-primary/20 text-primary'
                                : 'border-border/70 bg-background/70 text-foreground/80 hover:border-primary/40'
                          }`}
                        >
                          {reaction.emoji} {reaction.userIds.length}
                        </button>
                      );
                    })}

                    {REACTION_PALETTE.map((emoji) => (
                      <button
                        key={`${message.messageId}-add-${emoji}`}
                        type="button"
                        disabled={disabled}
                        onClick={() =>
                          onToggleReaction({
                            messageId: message.messageId,
                            emoji,
                          })
                        }
                        className="rounded-full border border-transparent px-1 text-[11px] text-muted-foreground transition-colors hover:border-border hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {showJumpToLatest ? (
          <Button
            type="button"
            size="sm"
            onClick={() => scrollToLatest('smooth')}
            className="absolute bottom-3 right-3 z-10 h-8 rounded-full px-3 text-[11px]"
          >
            <ChevronDown className="mr-1 size-3.5" />
            {t('workspace.chatJumpToLatest')}
          </Button>
        ) : null}
      </div>

      <p className="mt-2 text-[10px] text-muted-foreground">{t('workspace.chatAiHint')}</p>
    </div>
  );
}

function AttachmentPreview({ attachment }: { attachment: ChatAttachment }) {
  if (attachment.kind === 'image') {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
        className="block overflow-hidden rounded border border-border/70"
      >
        <img
          src={attachment.url}
          alt={attachment.fileName}
          className="max-h-36 w-full object-cover"
          loading="lazy"
        />
      </a>
    );
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded border border-border/70 bg-background/60 px-1.5 py-1 text-[10px] text-foreground/90 hover:border-primary/40"
    >
      <Paperclip className="size-3 text-muted-foreground" />
      <span className="max-w-56 truncate">{attachment.fileName}</span>
    </a>
  );
}
