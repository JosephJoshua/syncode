import { Controller, Get } from '@nestjs/common';
import { COLLAB_INTERNAL } from '@syncode/contracts';

/**
 * Public health endpoint for k8s liveness probes and operational tooling.
 *
 * Kept on its own controller so it can bypass `InternalCallbackGuard`. All
 * other `/internal/*` routes require the shared secret header.
 */
@Controller()
export class HealthController {
  @Get(COLLAB_INTERNAL.HEALTH.route)
  health() {
    return { status: 'ok' as const };
  }
}
