import type { RoomRole } from '../types/room.js';
import { RoomRole as RoomRoleValues } from '../types/room.js';

const ALL_ROOM_CAPABILITIES = [
  // Code
  'code:view',
  'code:edit',
  'code:run',
  'code:submit',
  // Whiteboard
  'whiteboard:view',
  'whiteboard:draw',
  // Media
  'media:audio',
  'media:video',
  'media:screenshare',
  // Chat
  'chat:send',
  // Room management
  'room:change-phase',
  'room:select-problem',
  'room:settings',
  // Participant
  'participant:invite',
  'participant:kick',
  'participant:assign-role',
  // Recording
  'recording:toggle',
  'recording:replay',
  // AI
  'ai:request-hint',
  'ai:request-review',
] as const;

export type RoomCapability = (typeof ALL_ROOM_CAPABILITIES)[number];

export const ALL_ROOM_CAPABILITIES_SET: ReadonlySet<RoomCapability> = new Set(
  ALL_ROOM_CAPABILITIES,
);

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
  'room:select-problem',
  'recording:toggle',
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

const SPECTATOR_CAPABILITIES: ReadonlySet<RoomCapability> = new Set<RoomCapability>([
  'code:view',
  'whiteboard:view',
  'chat:send',
  'recording:replay',
]);

export const ROOM_ROLE_PERMISSIONS: Record<RoomRole, ReadonlySet<RoomCapability>> = {
  [RoomRoleValues.HOST]: ALL_ROOM_CAPABILITIES_SET,
  [RoomRoleValues.INTERVIEWER]: INTERVIEWER_CAPABILITIES,
  [RoomRoleValues.CANDIDATE]: CANDIDATE_CAPABILITIES,
  [RoomRoleValues.SPECTATOR]: SPECTATOR_CAPABILITIES,
};

export function hasRoomPermission(role: RoomRole, capability: RoomCapability): boolean {
  return ROOM_ROLE_PERMISSIONS[role].has(capability);
}

export function getRoomPermissions(role: RoomRole): ReadonlySet<RoomCapability> {
  return ROOM_ROLE_PERMISSIONS[role];
}
