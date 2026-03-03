import { SetMetadata } from '@nestjs/common';

export const ROOM_PERMISSION_KEY = 'roomPermission';

/**
 * TODO: Implement room permission metadata attachment
 * - Attach required room permission to route handler
 * - Used by RoomPermissionGuard to check permissions
 */
export const RequireRoomPermission = (permission: string) =>
  SetMetadata(ROOM_PERMISSION_KEY, permission);
