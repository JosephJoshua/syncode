import type { RoomRole } from '../types/room.js';
import { RoomRole as RoomRoleValues } from '../types/room.js';

const ALL_ROOM_CAPABILITIES = [
  'code:view',
  'code:edit',
  'code:run',
  'code:submit',
  'whiteboard:view',
  'whiteboard:draw',
  'media:audio',
  'media:video',
  'media:screenshare',
  'chat:send',
  'room:change-phase',
  'room:select-problem',
  'room:settings',
  'participant:invite',
  'participant:kick',
  'participant:assign-role',
  'recording:toggle',
  'recording:replay',
  'ai:request-hint',
  'ai:request-review',
] as const;

export type RoomCapability = (typeof ALL_ROOM_CAPABILITIES)[number];

export const ALL_ROOM_CAPABILITIES_SET: ReadonlySet<RoomCapability> = new Set(
  ALL_ROOM_CAPABILITIES,
);

export const HOST_OVERRIDE_CAPABILITIES: ReadonlySet<RoomCapability> = new Set<RoomCapability>([
  'room:change-phase',
  'room:select-problem',
  'room:settings',
  'participant:invite',
  'participant:kick',
  'participant:assign-role',
  'recording:toggle',
  'recording:replay',
]);

const INTERVIEWER_CAPABILITIES: ReadonlySet<RoomCapability> = new Set<RoomCapability>([
  'code:view',
  'code:edit',
  'code:run',
  'code:submit',
  'whiteboard:view',
  'whiteboard:draw',
  'media:audio',
  'media:video',
  'media:screenshare',
  'chat:send',
  'room:change-phase',
  'recording:replay',
  'ai:request-hint',
  'ai:request-review',
]);

const CANDIDATE_CAPABILITIES: ReadonlySet<RoomCapability> = new Set<RoomCapability>([
  'code:view',
  'code:edit',
  'code:run',
  'code:submit',
  'whiteboard:view',
  'whiteboard:draw',
  'media:audio',
  'media:video',
  'media:screenshare',
  'chat:send',
  'recording:replay',
  'ai:request-hint',
]);

const OBSERVER_CAPABILITIES: ReadonlySet<RoomCapability> = new Set<RoomCapability>([
  'code:view',
  'whiteboard:view',
  'chat:send',
  'recording:replay',
]);

export const ROOM_ROLE_PERMISSIONS: Record<RoomRole, ReadonlySet<RoomCapability>> = {
  [RoomRoleValues.INTERVIEWER]: INTERVIEWER_CAPABILITIES,
  [RoomRoleValues.CANDIDATE]: CANDIDATE_CAPABILITIES,
  [RoomRoleValues.OBSERVER]: OBSERVER_CAPABILITIES,
};

function resolveBasePermissions(role: RoomRole): ReadonlySet<RoomCapability> {
  return ROOM_ROLE_PERMISSIONS[role];
}

export function hasRoomPermission(role: RoomRole, capability: RoomCapability): boolean {
  return resolveBasePermissions(role).has(capability);
}

export function getRoomPermissions(role: RoomRole): ReadonlySet<RoomCapability> {
  return resolveBasePermissions(role);
}

export function resolveRoomPermissions(
  role: RoomRole,
  options?: {
    isHost?: boolean;
  },
): ReadonlySet<RoomCapability> {
  const basePermissions = resolveBasePermissions(role);

  if (!options?.isHost) {
    return basePermissions;
  }

  return new Set([...basePermissions, ...HOST_OVERRIDE_CAPABILITIES]);
}

export function hasResolvedRoomPermission(
  role: RoomRole,
  capability: RoomCapability,
  options?: {
    isHost?: boolean;
  },
): boolean {
  return resolveRoomPermissions(role, options).has(capability);
}
