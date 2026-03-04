export const RoomStatus = {
  WAITING: 'waiting',
  WARMUP: 'warmup',
  CODING: 'coding',
  WRAPUP: 'wrapup',
  FINISHED: 'finished',
} as const;

export type RoomStatus = (typeof RoomStatus)[keyof typeof RoomStatus];

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
  displayName: string;
  avatarUrl?: string;
  role: RoomRole;
  joinedAt: Date;
  isActive: boolean;
}
