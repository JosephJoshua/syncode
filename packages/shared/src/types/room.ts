export const ROOM_MODES = ['peer', 'ai'] as const;
export type RoomMode = (typeof ROOM_MODES)[number];

export const ROOM_STATUSES = ['waiting', 'warmup', 'coding', 'wrapup', 'finished'] as const;

export const RoomStatus = {
  WAITING: 'waiting',
  WARMUP: 'warmup',
  CODING: 'coding',
  WRAPUP: 'wrapup',
  FINISHED: 'finished',
} as const;

export type RoomStatus = (typeof RoomStatus)[keyof typeof RoomStatus];

export const ALL_ROOM_ROLES = ['host', 'interviewer', 'candidate', 'spectator'] as const;
export const JOINABLE_ROOM_ROLES = ['interviewer', 'candidate', 'spectator'] as const;

export const RoomRole = {
  HOST: 'host',
  INTERVIEWER: 'interviewer',
  CANDIDATE: 'candidate',
  SPECTATOR: 'spectator',
} as const;

export type RoomRole = (typeof RoomRole)[keyof typeof RoomRole];

export interface RoomParticipant {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: RoomRole;
  joinedAt: Date;
  isActive: boolean;
}
