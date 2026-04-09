import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { AuthenticatedClient } from '../auth/index.js';

export interface RoomEntry {
  roomId: string;
  createdAt: number;
  phase: string;
  editorLocked: boolean;
  clients: Map<string, AuthenticatedClient>;
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
      clients: new Map(),
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
  ): RoomEntry {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new NotFoundException(`Room ${roomId} not found`);
    }

    room.phase = state.phase;
    room.editorLocked = state.editorLocked;
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
}
