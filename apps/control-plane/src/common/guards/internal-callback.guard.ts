import { timingSafeEqual } from 'node:crypto';
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '@/config/env.config.js';

export const INTERNAL_CALLBACK_HEADER = 'x-internal-secret';

/**
 * Authenticates internal plane-to-plane callback endpoints via a shared secret.
 *
 * Callers (collab-plane, other internal services) must attach the secret in the
 * `X-Internal-Secret` header. Comparison is constant-time to avoid timing
 * attacks. Missing or mismatched header results in 401.
 */
@Injectable()
export class InternalCallbackGuard implements CanActivate {
  private readonly expectedBuffer: Buffer;

  constructor(configService: ConfigService<EnvConfig>) {
    const secret = configService.get('INTERNAL_CALLBACK_SECRET', { infer: true });
    if (!secret) {
      throw new Error('INTERNAL_CALLBACK_SECRET is not configured');
    }
    this.expectedBuffer = Buffer.from(secret, 'utf8');
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();

    const raw = request.headers[INTERNAL_CALLBACK_HEADER];
    const provided = Array.isArray(raw) ? raw[0] : raw;

    if (typeof provided !== 'string' || provided.length === 0) {
      throw new UnauthorizedException({ message: 'Missing internal secret' });
    }

    const providedBuffer = Buffer.from(provided, 'utf8');

    // timingSafeEqual requires equal-length buffers; bail early otherwise.
    if (providedBuffer.length !== this.expectedBuffer.length) {
      throw new UnauthorizedException({ message: 'Invalid internal secret' });
    }

    if (!timingSafeEqual(providedBuffer, this.expectedBuffer)) {
      throw new UnauthorizedException({ message: 'Invalid internal secret' });
    }

    return true;
  }
}
