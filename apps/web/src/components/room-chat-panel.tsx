import type {
  ChatAttachment,
  ChatMention,
  ChatMessage,
  ChatReactToggleEventData,
  ChatSendEventData,
} from '@syncode/contracts';
import { Badge, Button } from '@syncode/ui';
import { Bot, ChevronDown, Loader2, Paperclip, Reply, Send, X } from 'lucide-react';
import {
  type ChangeEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { Participant } from './room-participant-card.js';

const REACTION_PALETTE = ['👍', '🔥', '✅', '💡'] as const;
const SCROLL_BOTTOM_THRESHOLD_PX = 24;

function resolveMentions(text: string, usersByUsername: Map<string, Participant>): ChatMention[] {
  const found: ChatMention[] = [];
  const seen = new Set<string>();

  const mentionRegex = /@([a-zA-Z0-9_]+)/g;
  for (const match of text.matchAll(mentionRegex)) {
    const raw = match[1]?.trim();
    if (!raw) {
      continue;
    }

    const normalized = raw.toLowerCase();
    if (normalized === 'ai') {
      const key = 'ai:@ai';
      if (!seen.has(key)) {
        seen.add(key);
        found.push({ kind: 'ai', value: '@ai' });
      }
      continue;
    }

    const user = usersByUsername.get(normalized);
    if (!user) {
      continue;
    }

    const key = `user:${user.userId}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    found.push({
      kind: 'user',
      value: `@${user.username}`,
      userId: user.userId,
    });
  }

  return found;
}

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

interface ActiveMentionState {
  query: string;
  start: number;
  end: number;
}

function getActiveMentionState(draft: string, cursorPosition: number): ActiveMentionState | null {
  if (cursorPosition < 0 || cursorPosition > draft.length) {
    return null;
  }

  const beforeCursor = draft.slice(0, cursorPosition);
  const match = beforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/);
  if (!match) {
    return null;
  }

  const mentionBody = match[1] ?? '';
  return {
    query: mentionBody.toLowerCase(),
    start: cursorPosition - mentionBody.length - 1,
    end: cursorPosition,
  };
}

interface RoomChatPanelProps {
  currentUserId: string | null;
  participants: Participant[];
  messages: ChatMessage[];
  onSendMessage: (data: ChatSendEventData) => void;
  onToggleReaction: (data: ChatReactToggleEventData) => void;
  onUploadMedia: (file: File) => Promise<ChatAttachment>;
  disabled?: boolean;
  showHeader?: boolean;
  readAt?: number;
}

export function RoomChatPanel({
  currentUserId,
  participants,
  messages,
  onSendMessage,
  onToggleReaction,
  onUploadMedia,
  disabled = false,
  showHeader = true,
  readAt = 0,
}: RoomChatPanelProps) {
  const { t } = useTranslation('rooms');
  const [draft, setDraft] = useState('');
  const [replyToMessageId, setReplyToMessageId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const usersById = useMemo(() => {
    return new Map(participants.map((participant) => [participant.userId, participant]));
  }, [participants]);

  const usersByUsername = useMemo(() => {
    return new Map(
      participants.map((participant) => [participant.username.toLowerCase(), participant]),
    );
  }, [participants]);

  const messagesById = useMemo(() => {
    return new Map(messages.map((message) => [message.messageId, message]));
  }, [messages]);

  const replyToMessage = replyToMessageId ? (messagesById.get(replyToMessageId) ?? null) : null;

  const mentionTabs = useMemo(() => {
    const seen = new Set<string>();
    const users = participants
      .filter((participant) => participant.userId !== currentUserId)
      .filter((participant) => {
        const username = participant.username.toLowerCase();
        if (seen.has(username)) return false;
        seen.add(username);
        return true;
      })
      .map((participant) => ({
        key: participant.userId,
        label: `@${participant.username}`,
        token: `@${participant.username}`,
        searchKey: participant.username.toLowerCase(),
      }));

    return [{ key: 'ai', label: '@ai', token: '@ai', searchKey: 'ai' }, ...users];
  }, [participants, currentUserId]);

  const activeMention = useMemo(
    () => getActiveMentionState(draft, cursorPosition),
    [draft, cursorPosition],
  );

  const mentionTabSuggestions = useMemo(() => {
    if (!activeMention) {
      return [];
    }

    if (!activeMention.query) {
      return mentionTabs;
    }

    return mentionTabs.filter((tab) => tab.searchKey.startsWith(activeMention.query));
  }, [mentionTabs, activeMention]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text && attachments.length === 0) {
      return;
    }

    setIsSending(true);
    try {
      const mentions = resolveMentions(text, usersByUsername);
      onSendMessage({
        text,
        replyToMessageId,
        mentions,
        attachments,
      });
      setDraft('');
      setCursorPosition(0);
      setReplyToMessageId(null);
      setAttachments([]);
    } finally {
      setIsSending(false);
    }
  };

  const handleFilePick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setIsUploading(true);
    try {
      const attachment = await onUploadMedia(file);
      setAttachments((prev) => [...prev, attachment]);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('workspace.chatUploadFailed');
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  const insertMention = (token: string) => {
    const input = messageInputRef.current;
    const active = activeMention;
    if (!input) {
      setDraft((prev) => {
        const spacer = prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
        return `${prev}${spacer}${token} `;
      });
      return;
    }

    const start = active?.start ?? input.selectionStart ?? draft.length;
    const end = active?.end ?? input.selectionEnd ?? draft.length;
    const before = draft.slice(0, start);
    const after = draft.slice(end);

    const needsLeadingSpace = before.length > 0 && !/\s$/.test(before);
    const leadingSpace = needsLeadingSpace ? ' ' : '';
    const needsTrailingSpace = after.length === 0 || !/^\s/.test(after);
    const trailingSpace = needsTrailingSpace ? ' ' : '';

    const inserted = `${leadingSpace}${token}${trailingSpace}`;
    const nextDraft = `${before}${inserted}${after}`;
    const nextCursor = before.length + inserted.length;

    setDraft(nextDraft);
    setCursorPosition(nextCursor);
    setTimeout(() => {
      messageInputRef.current?.focus();
      messageInputRef.current?.setSelectionRange(nextCursor, nextCursor);
    }, 0);
  };

  const isComposerDisabled = disabled || isUploading || isSending;

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
                          onClick={() =>
                            onToggleReaction({
                              messageId: message.messageId,
                              emoji: reaction.emoji,
                            })
                          }
                          className={`rounded-full border px-1.5 py-0.5 text-[11px] transition-colors ${
                            isActive
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
                        onClick={() =>
                          onToggleReaction({
                            messageId: message.messageId,
                            emoji,
                          })
                        }
                        className="rounded-full border border-transparent px-1 text-[11px] text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                      >
                        {emoji}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => setReplyToMessageId(message.messageId)}
                      className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <Reply className="size-3" />
                      {t('workspace.chatReply')}
                    </button>
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

      <div className="mt-2 space-y-2">
        {replyToMessage ? (
          <div className="flex items-center justify-between rounded border border-border/70 bg-background/60 px-2 py-1 text-[10px] text-muted-foreground">
            <span className="line-clamp-1">
              {t('workspace.chatReplyingTo')}{' '}
              {replyToMessage.text || t('workspace.chatAttachmentOnly')}
            </span>
            <button
              type="button"
              onClick={() => setReplyToMessageId(null)}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </div>
        ) : null}

        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {attachments.map((attachment, index) => (
              <div
                key={`${attachment.key}-${index}`}
                className="inline-flex items-center gap-1 rounded border border-border/70 bg-background/70 px-1.5 py-1 text-[10px]"
              >
                {attachment.kind === 'image' ? (
                  <img
                    src={attachment.url}
                    alt={attachment.fileName}
                    className="h-7 w-7 rounded object-cover"
                  />
                ) : (
                  <Paperclip className="size-3 text-muted-foreground" />
                )}
                <span className="max-w-28 truncate">{attachment.fileName}</span>
                <button
                  type="button"
                  onClick={() =>
                    setAttachments((prev) => prev.filter((item) => item.key !== attachment.key))
                  }
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {activeMention ? (
          <div className="space-y-1">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {t('workspace.chatMentionTabsLabel')}
            </p>
            <div className="flex gap-1 overflow-x-auto pb-0.5">
              {mentionTabSuggestions.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => insertMention(tab.token)}
                  disabled={isComposerDisabled}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/70 bg-background/70 px-2 py-1 text-[10px] text-foreground/85 transition-colors hover:border-primary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {tab.key === 'ai' ? <Bot className="size-3 text-primary/80" /> : null}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex items-end gap-1.5">
          <textarea
            ref={messageInputRef}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setCursorPosition(event.target.selectionStart ?? event.target.value.length);
            }}
            onSelect={(event) => {
              setCursorPosition(event.currentTarget.selectionStart ?? 0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                if (!isComposerDisabled) {
                  handleSend();
                }
              }
            }}
            placeholder={t('workspace.chatInputPlaceholder')}
            rows={2}
            disabled={isComposerDisabled}
            className="min-h-[52px] flex-1 resize-none rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/40"
          />

          <div className="flex flex-col gap-1">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(event) => void handleFilePick(event)}
            />
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="size-8"
              disabled={isComposerDisabled}
              onClick={() => fileInputRef.current?.click()}
              title={t('workspace.chatAttach')}
            >
              {isUploading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Paperclip className="size-3.5" />
              )}
            </Button>
            <Button
              type="button"
              size="icon"
              className="size-8"
              disabled={
                isComposerDisabled || (draft.trim().length === 0 && attachments.length === 0)
              }
              onClick={handleSend}
              title={t('workspace.chatSend')}
            >
              {isSending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
            </Button>
          </div>
        </div>

        <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Bot className="size-3" /> {t('workspace.chatAiHint')}
        </p>
      </div>
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
