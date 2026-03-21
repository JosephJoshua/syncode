import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Database } from '@syncode/db';
import { refreshTokens, users } from '@syncode/db';
import { CACHE_SERVICE, type ICacheService } from '@syncode/shared/ports';
import type { EnvConfig } from '@/config/env.config';
import { DB_CLIENT } from '@/modules/db/db.module';

const scryptAsync = promisify(scrypt);

interface RefreshTokenPayload {
  sub: string;
  email: string;
  tokenType: 'refresh';
  jti: string;
  iat: number;
  exp: number;
}

interface LoginUserProfile {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  role: 'user' | 'admin';
  avatarUrl: string | null;
  bio: string | null;
  stats: {
    totalSessions: number;
    totalProblems: number;
    streakDays: number;
  };
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB_CLIENT) private readonly db: Database,
    @Inject(CACHE_SERVICE) private readonly cacheService: ICacheService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<EnvConfig>,
  ) {}

  async register(username: string, email: string, password: string): Promise<{ userId: string }> {
    const normalizedEmail = this.normalizeEmail(email);
    const normalizedUsername = username.trim();

    const existingUser = await this.db.query.users.findFirst({
      columns: { id: true },
      where: (table, { and, eq, isNull, or }) =>
        and(
          isNull(table.deletedAt),
          or(eq(table.email, normalizedEmail), eq(table.username, normalizedUsername)),
        ),
    });

    if (existingUser) {
      throw new ConflictException('Email or username already registered');
    }

    const passwordHash = await this.hashPassword(password);

    try {
      const [createdUser] = await this.db
        .insert(users)
        .values({
          username: normalizedUsername,
          email: normalizedEmail,
          passwordHash,
        })
        .returning({ id: users.id });

      if (!createdUser) {
        throw new Error('Failed to create user');
      }

      return { userId: createdUser.id };
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        throw new ConflictException('Email or username already registered');
      }
      throw error;
    }
  }

  async login(
    identifier: string,
    password: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: LoginUserProfile;
  }> {
    const normalizedIdentifier = identifier.trim();
    const normalizedEmailIdentifier = this.normalizeEmail(normalizedIdentifier);

    const user = await this.db.query.users.findFirst({
      columns: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        role: true,
        avatarUrl: true,
        bio: true,
        passwordHash: true,
        bannedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      where: (table, { and, eq, isNull, or }) =>
        and(
          isNull(table.deletedAt),
          or(eq(table.email, normalizedEmailIdentifier), eq(table.username, normalizedIdentifier)),
        ),
    });

    if (!user || !(await this.verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.bannedAt) {
      throw new ForbiddenException('User is banned');
    }

    const tokenPair = await this.issueTokenPair(user.id, user.email);

    return {
      ...tokenPair,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName ?? null,
        role: user.role,
        avatarUrl: user.avatarUrl ?? null,
        bio: user.bio ?? null,
        stats: {
          totalSessions: 0,
          totalProblems: 0,
          streakDays: 0,
        },
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    };
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = await this.verifyRefreshToken(refreshToken);
    await this.assertRefreshTokenIsUsable(payload);

    const user = await this.db.query.users.findFirst({
      columns: {
        id: true,
        email: true,
        bannedAt: true,
      },
      where: (table, { and, eq, isNull }) =>
        and(eq(table.id, payload.sub), isNull(table.deletedAt)),
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (user.bannedAt) {
      await this.revokeAllRefreshTokensForUser(user.id);
      throw new UnauthorizedException('User is banned');
    }

    await this.revokeRefreshTokenByPayload(payload);

    return this.issueTokenPair(user.id, user.email);
  }

  async logout(refreshToken: string): Promise<void> {
    const payload = await this.verifyRefreshToken(refreshToken);
    await this.revokeRefreshTokenByPayload(payload);
  }

  async revokeAllRefreshTokensForUser(userId: string): Promise<void> {
    const nowUnixSeconds = Math.floor(Date.now() / 1_000);

    await Promise.all([
      this.cacheService.set(this.getRevokedAfterKey(userId), nowUnixSeconds),
      this.cacheService.delByPattern(`${this.getActiveTokenPrefix(userId)}*`),
    ]);
  }

  private async issueTokenPair(
    userId: string,
    email: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = await this.signAccessToken(userId, email);
    const refreshJti = randomUUID();

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: userId,
        email,
        tokenType: 'refresh',
        jti: refreshJti,
      },
      {
        secret: this.getRefreshTokenSecret(),
        expiresIn: this.getRefreshTokenExpirationSeconds(),
      },
    );

    const decodedPayload = this.decodeJwtPayload(refreshToken);
    if (!decodedPayload?.exp) {
      throw new Error('Generated refresh token is missing exp claim');
    }

    const ttlSeconds = this.getRemainingTtlSeconds(decodedPayload.exp);
    const tokenHash = this.hashToken(refreshToken);

    await Promise.all([
      this.cacheService.set(this.getActiveTokenKey(userId, refreshJti), true, ttlSeconds),
      this.db.insert(refreshTokens).values({
        userId,
        tokenHash,
        expiresAt: new Date(decodedPayload.exp * 1_000),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  private async signAccessToken(userId: string, email: string): Promise<string> {
    return this.jwtService.signAsync({
      sub: userId,
      email,
      tokenType: 'access',
    });
  }

  private async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.getRefreshTokenSecret(),
      });

      if (
        payload.tokenType !== 'refresh' ||
        !payload.jti ||
        !payload.sub ||
        !payload.exp ||
        !payload.iat
      ) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private async assertRefreshTokenIsUsable(payload: RefreshTokenPayload): Promise<void> {
    const [isRevoked, isActive, revokedAfter] = await Promise.all([
      this.cacheService.exists(this.getRevokedTokenKey(payload.jti)),
      this.cacheService.exists(this.getActiveTokenKey(payload.sub, payload.jti)),
      this.cacheService.get<number>(this.getRevokedAfterKey(payload.sub)),
    ]);

    if (isRevoked || !isActive) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (typeof revokedAfter === 'number' && payload.iat <= revokedAfter) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private async revokeRefreshTokenByPayload(payload: RefreshTokenPayload): Promise<void> {
    const ttlSeconds = this.getRemainingTtlSeconds(payload.exp);

    await Promise.all([
      this.cacheService.set(this.getRevokedTokenKey(payload.jti), true, ttlSeconds),
      this.cacheService.del(this.getActiveTokenKey(payload.sub, payload.jti)),
    ]);
  }

  private getRevokedTokenKey(jti: string): string {
    return `auth:refresh:revoked:${jti}`;
  }

  private getActiveTokenPrefix(userId: string): string {
    return `auth:refresh:active:${userId}:`;
  }

  private getActiveTokenKey(userId: string, jti: string): string {
    return `${this.getActiveTokenPrefix(userId)}${jti}`;
  }

  private getRevokedAfterKey(userId: string): string {
    return `auth:refresh:revoked-after:${userId}`;
  }

  private getRefreshTokenSecret(): string {
    const refreshSecret = this.config.get('JWT_REFRESH_SECRET', { infer: true });
    if (!refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET is not configured');
    }
    return refreshSecret;
  }

  private getRefreshTokenExpirationSeconds(): number {
    const expiration = this.config.get('JWT_REFRESH_EXPIRATION', { infer: true }) ?? '7d';
    return this.parseDurationToSeconds(expiration);
  }

  private getRemainingTtlSeconds(expUnixSeconds: number): number {
    return Math.max(1, expUnixSeconds - Math.floor(Date.now() / 1_000));
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private parseDurationToSeconds(duration: string): number {
    if (/^\d+$/.test(duration)) {
      return Number.parseInt(duration, 10);
    }

    const matchedDuration = duration.match(/^(\d+)([smhd])$/);
    if (!matchedDuration) {
      throw new Error(`Unsupported JWT duration format: ${duration}`);
    }

    const valueText = matchedDuration.at(1);
    const unit = matchedDuration.at(2);
    if (!valueText || !unit) {
      throw new Error(`Unsupported JWT duration format: ${duration}`);
    }

    const value = Number.parseInt(valueText, 10);

    if (unit === 's') return value;
    if (unit === 'm') return value * 60;
    if (unit === 'h') return value * 60 * 60;
    return value * 60 * 60 * 24;
  }

  private decodeJwtPayload(token: string): { exp?: number } | null {
    const payload = this.jwtService.decode(token);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }

    return payload as { exp?: number };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${salt}:${derivedKey.toString('hex')}`;
  }

  private async verifyPassword(password: string, storedPasswordHash: string): Promise<boolean> {
    const [salt, storedHash] = storedPasswordHash.split(':');
    if (!salt || !storedHash) {
      return false;
    }

    try {
      const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
      const storedKey = Buffer.from(storedHash, 'hex');

      if (storedKey.length !== derivedKey.length) {
        return false;
      }

      return timingSafeEqual(storedKey, derivedKey);
    } catch {
      return false;
    }
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    if (typeof error !== 'object' || !error || !('code' in error)) {
      return false;
    }

    const dbError = error as { code?: string };
    return dbError.code === '23505';
  }
}
