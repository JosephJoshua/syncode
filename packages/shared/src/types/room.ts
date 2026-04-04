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

export const ROOM_ROLES = ['host', 'interviewer', 'candidate', 'spectator'] as const;

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

// ── Stage transition map ──────

/**
 * Defines valid next stages from each room status.
 * The interview follows a linear flow: waiting → warmup → coding → wrapup → finished.
 * Any active stage can also jump directly to "finished" (end session early).
 */
export const VALID_STAGE_TRANSITIONS: Record<RoomStatus, readonly RoomStatus[]> = {
  [RoomStatus.WAITING]: [RoomStatus.WARMUP, RoomStatus.FINISHED],
  [RoomStatus.WARMUP]: [RoomStatus.CODING, RoomStatus.FINISHED],
  [RoomStatus.CODING]: [RoomStatus.WRAPUP, RoomStatus.FINISHED],
  [RoomStatus.WRAPUP]: [RoomStatus.FINISHED],
  [RoomStatus.FINISHED]: [],
} as const;

/**
 * Returns the list of valid next stages for a given room status.
 */
export function getNextStages(current: RoomStatus): readonly RoomStatus[] {
  return VALID_STAGE_TRANSITIONS[current];
}

/**
 * Checks whether transitioning from `current` to `next` is valid.
 */
export function isValidTransition(current: RoomStatus, next: RoomStatus): boolean {
  return VALID_STAGE_TRANSITIONS[current].includes(next);
}

/* labels for each room stage, useful for UI display. */
export const ROOM_STATUS_LABELS: Record<RoomStatus, string> = {
  [RoomStatus.WAITING]: 'Waiting',
  [RoomStatus.WARMUP]: 'Warm-up',
  [RoomStatus.CODING]: 'Coding',
  [RoomStatus.WRAPUP]: 'Wrap-up',
  [RoomStatus.FINISHED]: 'Finished',
} as const;
