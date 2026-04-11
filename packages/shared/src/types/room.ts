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

export const ROOM_ROLES = ['interviewer', 'candidate', 'observer'] as const;
export const JOINABLE_ROOM_ROLES = ['interviewer', 'candidate', 'observer'] as const;

export const RoomRole = {
  INTERVIEWER: 'interviewer',
  CANDIDATE: 'candidate',
  OBSERVER: 'observer',
} as const;

export type RoomRole = (typeof RoomRole)[keyof typeof RoomRole];

export function isRoomRole(value: string): value is RoomRole {
  return (ROOM_ROLES as readonly string[]).includes(value);
}

export interface RoomParticipant {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: RoomRole;
  joinedAt: Date;
  isActive: boolean;
}

export const VALID_STATUS_TRANSITIONS: Record<RoomStatus, readonly RoomStatus[]> = {
  [RoomStatus.WAITING]: [RoomStatus.WARMUP, RoomStatus.FINISHED],
  [RoomStatus.WARMUP]: [RoomStatus.CODING, RoomStatus.FINISHED],
  [RoomStatus.CODING]: [RoomStatus.WRAPUP, RoomStatus.FINISHED],
  [RoomStatus.WRAPUP]: [RoomStatus.FINISHED],
  [RoomStatus.FINISHED]: [],
} as const;

export function getNextStatuses(current: RoomStatus): readonly RoomStatus[] {
  return VALID_STATUS_TRANSITIONS[current];
}

export function isValidStatusTransition(current: RoomStatus, next: RoomStatus): boolean {
  return VALID_STATUS_TRANSITIONS[current].includes(next);
}

export const ROOM_STATUS_LABELS: Record<RoomStatus, string> = {
  [RoomStatus.WAITING]: 'Waiting',
  [RoomStatus.WARMUP]: 'Warm-up',
  [RoomStatus.CODING]: 'Coding',
  [RoomStatus.WRAPUP]: 'Wrap-up',
  [RoomStatus.FINISHED]: 'Finished',
} as const;
