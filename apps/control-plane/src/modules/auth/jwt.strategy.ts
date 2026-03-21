import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Database } from '@syncode/db';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { EnvConfig } from '@/config/env.config';
import { DB_CLIENT } from '@/modules/db/db.module';

/**
 * JWT payload structure
 */
interface JwtPayload {
  sub: string; // User ID
  email: string;
  iat: number;
  exp: number;
  tokenType?: 'access' | 'refresh';
}

/**
 * Validates JWT tokens and attaches the authenticated user to the request.
 *
 * Used by {@link JwtAuthGuard}
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private static extractAccessTokenFromCookie(request: Request): string | null {
    if (request.cookies && typeof request.cookies.accessToken === 'string') {
      return request.cookies.accessToken;
    }

    const cookieHeader = request.headers.cookie;
    if (!cookieHeader) {
      return null;
    }

    const accessTokenCookie = cookieHeader
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('accessToken='));

    if (!accessTokenCookie) {
      return null;
    }

    const encodedValue = accessTokenCookie.slice('accessToken='.length);
    if (!encodedValue) {
      return null;
    }

    return decodeURIComponent(encodedValue);
  }

  constructor(
    config: ConfigService<EnvConfig>,
    @Inject(DB_CLIENT) private readonly db: Database,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request: Request) => JwtStrategy.extractAccessTokenFromCookie(request),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', { infer: true })!,
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
  async validate(payload: JwtPayload) {
    if (payload.tokenType && payload.tokenType !== 'access') {
      throw new UnauthorizedException('Invalid access token');
    }

    const user = await this.db.query.users.findFirst({
      columns: {
        id: true,
        email: true,
        bannedAt: true,
      },
      where: (table, { and, eq, isNull }) =>
        and(eq(table.id, payload.sub), isNull(table.deletedAt)),
    });

    if (!user || user.bannedAt) {
      throw new UnauthorizedException('Unauthorized');
    }

    return {
      id: user.id,
      email: user.email,
    };
  }
}
