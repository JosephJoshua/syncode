import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type {
  ChatAttachment,
  ChatMention,
  ChatMessage,
  ChatReaction,
  ChatReactionUpdatedEventData,
  ChatReadState,
  ChatReadUpdatedEventData,
} from '@syncode/contracts';
import type { AuthenticatedClient } from '../auth/index.js';

const MAX_CHAT_MESSAGES_PER_ROOM = 500;

export interface RoomEntry {
  roomId: string;
  createdAt: number;
  phase: string;
  editorLocked: boolean;
  language: string | null;
  clients: Map<string, AuthenticatedClient>;
  chatMessages: ChatMessage[];
  chatReadAtByUserId: Map<string, number>;
}

export interface RoomStateUpdate {
  room: RoomEntry;
  previousPhase: string;
  previousEditorLocked: boolean;
}

interface CreateChatMessageInput {
  userId: string;
  text: string;
  replyToMessageId: string | null;
  mentions: ChatMention[];
  attachments: ChatAttachment[];
}

interface ToggleChatReactionInput {
  messageId: string;
  userId: string;
  emoji: string;
}

interface MarkChatReadInput {
  userId: string;
  upTo?: number;
}

@Injectable()
export class RoomRegistry {
  private readonly logger = new Logger(RoomRegistry.name);
  private readonly rooms = new Map<string, RoomEntry>();

  createRoom(
    roomId: string,
    options?: {
      phase?: string;
      editorLocked?: boolean;
      language?: string;
    },
  ): RoomEntry {
    if (this.rooms.has(roomId)) {
      throw new ConflictException(`Room ${roomId} already exists`);
    }

    const entry: RoomEntry = {
      roomId,
      createdAt: Date.now(),
      phase: options?.phase ?? 'waiting',
      editorLocked: options?.editorLocked ?? false,
      language: options?.language ?? null,
      clients: new Map(),
      chatMessages: [],
      chatReadAtByUserId: new Map(),
    };

    this.rooms.set(roomId, entry);
    this.logger.log(`Room created: ${roomId}`);
    return entry;
  }

  hasRoom(roomId: string): boolean {
    return this.rooms.has(roomId);
  }

  getRoom(roomId: string): RoomEntry | undefined {
    return this.rooms.get(roomId);
  }

  updateRoomState(
    roomId: string,
    state: {
      phase: string;
      editorLocked: boolean;
    },
  ): RoomStateUpdate {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new NotFoundException(`Room ${roomId} not found`);
    }

    const previousPhase = room.phase;
    const previousEditorLocked = room.editorLocked;

    room.phase = state.phase;
    room.editorLocked = state.editorLocked;

    return { room, previousPhase, previousEditorLocked };
  }

  updateLanguage(roomId: string, language: string): RoomEntry {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new NotFoundException(`Room ${roomId} not found`);
    }

    room.language = language;
    return room;
  }

  deleteRoom(roomId: string): boolean {
    const deleted = this.rooms.delete(roomId);
    if (deleted) {
      this.logger.log(`Room deleted: ${roomId}`);
    }
    return deleted;
  }

  addClient(roomId: string, userId: string, client: AuthenticatedClient): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new NotFoundException(`Room ${roomId} not found`);
    }
    if (room.clients.has(userId)) {
      throw new ConflictException(`Client ${userId} already exists in room ${roomId}`);
    }
    room.clients.set(userId, client);
    if (!room.chatReadAtByUserId.has(userId)) {
      room.chatReadAtByUserId.set(userId, Date.now());
    }
  }

  removeClient(roomId: string, userId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }
    return room.clients.delete(userId);
  }

  hasClient(roomId: string, userId: string): boolean {
    return this.rooms.get(roomId)?.clients.has(userId) ?? false;
  }

  getClient(roomId: string, userId: string): AuthenticatedClient | undefined {
    return this.rooms.get(roomId)?.clients.get(userId);
  }

  listChatMessages(roomId: string): ChatMessage[] {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new NotFoundException(`Room ${roomId} not found`);
    }
    return room.chatMessages;
  }

  listChatReadStates(roomId: string): ChatReadState[] {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new NotFoundException(`Room ${roomId} not found`);
    }

    return [...room.chatReadAtByUserId.entries()]
      .map(([userId, lastReadAt]) => ({ userId, lastReadAt }))
      .sort((a, b) => a.userId.localeCompare(b.userId));
  }

  createChatMessage(roomId: string, input: CreateChatMessageInput): ChatMessage {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new NotFoundException(`Room ${roomId} not found`);
    }

    const now = Date.now();
    const replyToMessageId =
      input.replyToMessageId &&
      room.chatMessages.some((msg) => msg.messageId === input.replyToMessageId)
        ? input.replyToMessageId
        : null;

    const message: ChatMessage = {
      messageId: randomUUID(),
      roomId,
      userId: input.userId,
      text: input.text,
      replyToMessageId,
      mentions: input.mentions,
      attachments: input.attachments,
      reactions: [],
      createdAt: now,
      updatedAt: now,
    };

    room.chatMessages.push(message);
    if (room.chatMessages.length > MAX_CHAT_MESSAGES_PER_ROOM) {
      room.chatMessages.shift();
    }

    return message;
  }

  toggleChatReaction(roomId: string, input: ToggleChatReactionInput): ChatReactionUpdatedEventData {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new NotFoundException(`Room ${roomId} not found`);
    }

    const message = room.chatMessages.find((item) => item.messageId === input.messageId);
    if (!message) {
      throw new NotFoundException(`Chat message ${input.messageId} not found in room ${roomId}`);
    }

    const existingReaction = message.reactions.find((reaction) => reaction.emoji === input.emoji);
    if (!existingReaction) {
      message.reactions.push({
        emoji: input.emoji,
        userIds: [input.userId],
      });
    } else if (existingReaction.userIds.includes(input.userId)) {
      existingReaction.userIds = existingReaction.userIds.filter((id) => id !== input.userId);
      if (existingReaction.userIds.length === 0) {
        message.reactions = message.reactions.filter((reaction) => reaction !== existingReaction);
      }
    } else {
      existingReaction.userIds = [...existingReaction.userIds, input.userId];
    }

    message.updatedAt = Date.now();
    message.reactions = this.sortReactions(message.reactions);

    return {
      messageId: message.messageId,
      reactions: message.reactions,
      updatedAt: message.updatedAt,
    };
  }

  markChatRead(roomId: string, input: MarkChatReadInput): ChatReadUpdatedEventData {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new NotFoundException(`Room ${roomId} not found`);
    }

    const now = Date.now();
    const requested = typeof input.upTo === 'number' ? Math.floor(input.upTo) : now;
    const normalized = Number.isFinite(requested) ? Math.max(0, Math.min(requested, now)) : now;
    const previous = room.chatReadAtByUserId.get(input.userId) ?? 0;
    const lastReadAt = Math.max(previous, normalized);

    room.chatReadAtByUserId.set(input.userId, lastReadAt);
    return { userId: input.userId, lastReadAt };
  }

  private sortReactions(reactions: ChatReaction[]): ChatReaction[] {
    return [...reactions].sort((a, b) => a.emoji.localeCompare(b.emoji));
  }
}
