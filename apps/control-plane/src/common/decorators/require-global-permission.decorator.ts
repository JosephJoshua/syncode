import { SetMetadata } from '@nestjs/common';

export const GLOBAL_PERMISSION_KEY = 'globalPermission';

/**
 * TODO: Implement permission metadata attachment
 * - Attach required permission to route handler
 * - Used by GlobalPermissionGuard to check permissions
 */
export const RequireGlobalPermission = (permission: string) =>
  SetMetadata(GLOBAL_PERMISSION_KEY, permission);
