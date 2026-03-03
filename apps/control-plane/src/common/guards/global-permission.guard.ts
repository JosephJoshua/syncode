import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class GlobalPermissionGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    // TODO: Implement permission checking
    return true;
  }
}
