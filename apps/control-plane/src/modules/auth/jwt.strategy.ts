import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Database } from '@syncode/db';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { EnvConfig } from '@/config/env.config';
import { DB_CLIENT } from '@/modules/db/db.module';
import type { AuthUser } from './auth.types.js';

/**
 * JWT payload structure
 */
interface JwtPayload {
  sub: string; // User ID
  email: string;
  iat: number;
  exp: number;
}

/**
 * Validates JWT tokens and attaches the authenticated user to the request.
 *
 * Used by {@link JwtAuthGuard}
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService<EnvConfig>,
    // biome-ignore lint/correctness/noUnusedPrivateClassMembers: used when user table is implemented
    @Inject(DB_CLIENT) private readonly db: Database,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('AUTH_JWT_SECRET', { infer: true })!,
    });
  }

  /**
   * Called automatically by Passport after token signature is verified.
   *
   * Should return user object that will be attached to request.user.
   *
   * @param payload - Decoded JWT payload
   * @returns User object or throws UnauthorizedException
   */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    // TODO: Fetch user from database using payload.sub (user ID)

    return {
      id: payload.sub,
      email: payload.email,
    };
  }
}
