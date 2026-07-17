import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class RoomPermissionGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    // TODO: Implement room permission checking
    return true;
  }
}
