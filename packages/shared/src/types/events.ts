import type { RoomParticipant, RoomStatus } from './room';

export const RoomEvent = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',

  // Room
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_JOINED: 'room:joined',
  ROOM_LEFT: 'room:left',
  ROOM_STATUS_CHANGE: 'room:status-change',

  // Participants
  PARTICIPANT_JOIN: 'participant:join',
  PARTICIPANT_LEAVE: 'participant:leave',
  PARTICIPANT_UPDATE: 'participant:update',

  // Sync
  SYNC_UPDATE: 'sync:update',
  SYNC_REQUEST: 'sync:request',
  SYNC_RESPONSE: 'sync:response',
  CURSOR_UPDATE: 'cursor:update',

  // Chat
  CHAT_MESSAGE: 'chat:message',
} as const;

export type RoomEvent = (typeof RoomEvent)[keyof typeof RoomEvent];

// Client -> Server payloads
export interface RoomJoinPayload {
  roomCode: string;
  role?: string;
}

export interface CursorUpdatePayload {
  userId: string;
  position: { line: number; column: number };
}

// Server -> Client payloads
export interface RoomJoinedPayload {
  roomId: string;
  participant: RoomParticipant;
  participants: RoomParticipant[];
  status: RoomStatus;
}

export interface ParticipantJoinPayload {
  participant: RoomParticipant;
}

export interface ParticipantLeavePayload {
  userId: string;
  reason?: string;
}

export interface RoomStatusChangePayload {
  status: RoomStatus;
  changedBy: string;
}

// Bidirectional payloads
export interface SyncUpdatePayload {
  update: Uint8Array;
}

// Error payloads
export interface ErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}
