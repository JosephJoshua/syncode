/**
 * Typed WebSocket message envelope used on the collab-plane WebSocket.
 * Text frames only — binary frames are Yjs sync protocol.
 */
export interface CollabWsMessage<T = unknown> {
  type: string;
  data: T;
  timestamp: number;
}

/** Sent on join and on every state update. */
export interface RoomStateEventData {
  phase: string;
  editorLocked: boolean;
}

/** Sent when the room phase changes. */
export interface PhaseChangeEventData {
  phase: string;
  previousPhase: string;
}

/** Sent when the editor lock state changes. */
export interface EditorLockEventData {
  locked: boolean;
  lockedBy: string | null;
}

/** Sent when a participant toggles their ready status. */
export interface ParticipantReadyEventData {
  userId: string;
  isReady: boolean;
}

/** Sent when the active language is changed in the room. */
export interface LanguageChangeEventData {
  language: string;
  changedBy: string | null;
}

export type ChatMentionKind = 'user' | 'ai';

export interface ChatMention {
  kind: ChatMentionKind;
  value: string;
  userId?: string;
}

export type ChatAttachmentKind = 'image' | 'video' | 'audio' | 'file';

export interface ChatAttachment {
  kind: ChatAttachmentKind;
  key: string;
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ChatReaction {
  emoji: string;
  userIds: string[];
}

export interface ChatMessage {
  messageId: string;
  roomId: string;
  userId: string;
  text: string;
  replyToMessageId: string | null;
  mentions: ChatMention[];
  attachments: ChatAttachment[];
  reactions: ChatReaction[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatReadState {
  userId: string;
  lastReadAt: number;
}

/** Sent to a user when they join to hydrate room chat state. */
export interface ChatHistoryEventData {
  messages: ChatMessage[];
  readStates: ChatReadState[];
}

/** Sent when a new chat message is created in the room. */
export interface ChatMessageCreatedEventData {
  message: ChatMessage;
}

/** Sent when reactions for a message change. */
export interface ChatReactionUpdatedEventData {
  messageId: string;
  reactions: ChatReaction[];
  updatedAt: number;
}

/** Client request payload for sending a new chat message. */
export interface ChatSendEventData {
  text: string;
  replyToMessageId?: string | null;
  mentions?: ChatMention[];
  attachments?: ChatAttachment[];
}

/** Client request payload for toggling a reaction on an existing message. */
export interface ChatReactToggleEventData {
  messageId: string;
  emoji: string;
}

/** Client request payload for acknowledging chat messages as read. */
export interface ChatMarkReadEventData {
  upTo?: number;
}

/** Sent when a participant read marker changes. */
export interface ChatReadUpdatedEventData {
  userId: string;
  lastReadAt: number;
}

/** Reserved for future AI streaming support in the room chat. */
export interface AiChatStreamStartEventData {
  messageId: string;
  parentMessageId: string;
}

/** Reserved for future AI streaming support in the room chat. */
export interface AiChatStreamChunkEventData {
  messageId: string;
  chunk: string;
}

/** Reserved for future AI streaming support in the room chat. */
export interface AiChatStreamDoneEventData {
  messageId: string;
  text: string;
}

export const COLLAB_WS_EVENTS = {
  ROOM_STATE: 'room-state',
  PHASE_CHANGE: 'phase-change',
  EDITOR_LOCK: 'editor-lock',
  PARTICIPANT_READY: 'participant-ready',
  LANGUAGE_CHANGE: 'language-change',
  CHAT_HISTORY: 'chat-history',
  CHAT_MESSAGE_CREATED: 'chat-message-created',
  CHAT_REACTION_UPDATED: 'chat-reaction-updated',
  CHAT_MARK_READ: 'chat-mark-read',
  CHAT_READ_UPDATED: 'chat-read-updated',
  CHAT_SEND: 'chat-send',
  CHAT_REACT_TOGGLE: 'chat-react-toggle',
  CHAT_AI_STREAM_START: 'chat-ai-stream-start',
  CHAT_AI_STREAM_CHUNK: 'chat-ai-stream-chunk',
  CHAT_AI_STREAM_DONE: 'chat-ai-stream-done',
} as const;
