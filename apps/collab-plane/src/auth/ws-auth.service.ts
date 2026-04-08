import type { IncomingMessage } from 'node:http';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { CollabTokenPayload } from './collab-token-payload.js';

@Injectable()
export class WsAuthService {
  private readonly logger = new Logger(WsAuthService.name);

  constructor(private readonly jwtService: JwtService) {}

  /**
   * Extracts and verifies the collab JWT from the WebSocket upgrade request.
   *
   * Token is read from the `token` query parameter first, falling back to the
   * `Authorization: Bearer <token>` header.
   *
   * @returns Verified token payload with user identity
   * @throws {UnauthorizedException} if token is missing, expired, or invalid
   */
  async authenticate(request: IncomingMessage): Promise<CollabTokenPayload> {
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing authentication token');
    }

    try {
      return await this.jwtService.verifyAsync<CollabTokenPayload>(token);
    } catch (error) {
      this.logger.debug(`JWT verification failed: ${(error as Error).message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractToken(request: IncomingMessage): string | null {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    const queryToken = url.searchParams.get('token');
    if (queryToken) return queryToken;

    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    return null;
  }
}
