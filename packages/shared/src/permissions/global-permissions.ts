import type { UserRole } from '../types/user.js';
import { UserRole as UserRoleValues } from '../types/user.js';

const ALL_GLOBAL_CAPABILITIES = [
  // Rooms
  'room:create',
  'room:join',
  'room:list',
  'room:delete-own',
  'room:delete-any',
  'room:join-any',
  'room:force-close',
  // Problems
  'problem:view',
  'problem:create',
  'problem:edit',
  'problem:delete',
  // Users
  'user:view-profile',
  'user:edit-self',
  'user:list',
  'user:manage',
  'user:ban',
  // Sessions
  'session:view-own',
  'session:view-any',
  // Reports
  'report:view-own',
  'report:view-any',
  'report:export',
  // Platform
  'platform:view-analytics',
  'platform:manage-settings',
] as const;

export type GlobalCapability = (typeof ALL_GLOBAL_CAPABILITIES)[number];

export const ALL_GLOBAL_CAPABILITIES_SET: ReadonlySet<GlobalCapability> = new Set(
  ALL_GLOBAL_CAPABILITIES,
);

const USER_CAPABILITIES: ReadonlySet<GlobalCapability> = new Set<GlobalCapability>([
  'room:create',
  'room:join',
  'room:list',
  'room:delete-own',
  'problem:view',
  'user:view-profile',
  'user:edit-self',
  'session:view-own',
  'report:view-own',
]);

export const GLOBAL_ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<GlobalCapability>> = {
  [UserRoleValues.USER]: USER_CAPABILITIES,
  [UserRoleValues.ADMIN]: ALL_GLOBAL_CAPABILITIES_SET,
};

export function hasGlobalPermission(role: UserRole, capability: GlobalCapability): boolean {
  return GLOBAL_ROLE_PERMISSIONS[role].has(capability);
}

export function getGlobalPermissions(role: UserRole): ReadonlySet<GlobalCapability> {
  return GLOBAL_ROLE_PERMISSIONS[role];
}
