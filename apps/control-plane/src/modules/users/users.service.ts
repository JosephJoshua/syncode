import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import {
  ERROR_CODES,
  type PublicUserProfileResponse,
  type UpdateUserInput,
  type UserProfileResponse,
  type UserQuotasResponse,
} from '@syncode/contracts';
import type { Database } from '@syncode/db';
import {
  aiHints,
  aiMessages,
  aiReviews,
  GLOBAL_LIMIT_KEYS,
  rooms,
  runs,
  submissions,
  users,
} from '@syncode/db';
import { ROOM_STATUSES, RoomStatus } from '@syncode/shared';
import { and, eq, gte, inArray, isNull, ne, type SQL, sql } from 'drizzle-orm';
import type { AnyPgTable } from 'drizzle-orm/pg-core';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import { AuthService } from '../auth/auth.service.js';
import { toPublicUserProfile, toUserProfile } from './user-profile.mapper.js';

@Injectable()
export class UsersService {
  private static readonly userProfileColumns = {
    id: true,
    email: true,
    username: true,
    displayName: true,
    role: true,
    avatarUrl: true,
    bio: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  private static readonly publicUserProfileColumns = {
    id: true,
    username: true,
    displayName: true,
    avatarUrl: true,
    bio: true,
    createdAt: true,
  } as const;

  constructor(
    @Inject(DB_CLIENT) private readonly db: Database,
    private readonly authService: AuthService,
  ) {}

  async findById(id: string): Promise<UserProfileResponse> {
    const user = await this.db.query.users.findFirst({
      columns: UsersService.userProfileColumns,
      where: (table) => and(eq(table.id, id), isNull(table.deletedAt)),
    });

    if (!user) {
      throw new NotFoundException({
        message: 'User not found',
        code: ERROR_CODES.USER_NOT_FOUND,
      });
    }

    return toUserProfile(user);
  }

  async findPublicById(id: string): Promise<PublicUserProfileResponse> {
    const user = await this.db.query.users.findFirst({
      columns: UsersService.publicUserProfileColumns,
      where: (table) => and(eq(table.id, id), isNull(table.deletedAt)),
    });

    if (!user) {
      throw new NotFoundException({
        message: 'User not found',
        code: ERROR_CODES.USER_NOT_FOUND,
      });
    }

    return toPublicUserProfile(user);
  }

  async findByEmail(email: string): Promise<UserProfileResponse | null> {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.db.query.users.findFirst({
      columns: UsersService.userProfileColumns,
      where: (table) => and(eq(table.email, normalizedEmail), isNull(table.deletedAt)),
    });

    if (!user) {
      return null;
    }

    return toUserProfile(user);
  }

  async getQuotas(userId: string): Promise<UserQuotasResponse> {
    const startOfUtcDay = this.getStartOfUtcDay();
    const resetsAt = this.getNextUtcMidnight().toISOString();

    const [
      aiHintsCount,
      aiReviewsCount,
      aiMessagesCount,
      runsCount,
      submissionsCount,
      roomCount,
      limitRows,
    ] = await Promise.all([
      this.countRows(
        aiHints,
        and(eq(aiHints.userId, userId), gte(aiHints.createdAt, startOfUtcDay)),
      ),
      this.countRows(
        aiReviews,
        and(eq(aiReviews.userId, userId), gte(aiReviews.createdAt, startOfUtcDay)),
      ),
      this.countRows(
        aiMessages,
        and(eq(aiMessages.userId, userId), gte(aiMessages.createdAt, startOfUtcDay)),
      ),
      this.countRows(runs, and(eq(runs.userId, userId), gte(runs.createdAt, startOfUtcDay))),
      this.countRows(
        submissions,
        and(eq(submissions.userId, userId), gte(submissions.submittedAt, startOfUtcDay)),
      ),
      this.countRows(
        rooms,
        and(
          eq(rooms.hostId, userId),
          inArray(
            rooms.status,
            ROOM_STATUSES.filter((s) => s !== RoomStatus.FINISHED),
          ),
        ),
      ),
      this.db.query.globalLimits.findMany({
        columns: {
          key: true,
          value: true,
        },
        where: (table) =>
          inArray(table.key, [
            GLOBAL_LIMIT_KEYS.AI_DAILY,
            GLOBAL_LIMIT_KEYS.EXECUTION_DAILY,
            GLOBAL_LIMIT_KEYS.ROOMS_MAX_ACTIVE,
          ]),
      }),
    ]);

    const limits = this.toLimitMap(limitRows);

    return {
      ai: {
        used: aiHintsCount + aiReviewsCount + aiMessagesCount,
        limit: limits[GLOBAL_LIMIT_KEYS.AI_DAILY] ?? 0,
        resetsAt,
      },
      execution: {
        used: runsCount + submissionsCount,
        limit: limits[GLOBAL_LIMIT_KEYS.EXECUTION_DAILY] ?? 0,
        resetsAt,
      },
      rooms: {
        activeCount: roomCount,
        maxActive: limits[GLOBAL_LIMIT_KEYS.ROOMS_MAX_ACTIVE] ?? 0,
      },
    };
  }

  async create(_data: {
    email: string;
    passwordHash: string;
    name?: string;
  }): Promise<UserProfileResponse> {
    // TODO: Implement user creation
    throw new NotImplementedException();
  }

  async update(id: string, data: UpdateUserInput): Promise<UserProfileResponse> {
    const normalizedUsername = data.username?.trim() || undefined;

    if (normalizedUsername) {
      const existingUser = await this.db.query.users.findFirst({
        columns: { id: true },
        where: (table) =>
          and(eq(table.username, normalizedUsername), ne(table.id, id), isNull(table.deletedAt)),
      });

      if (existingUser) {
        throw new ConflictException({
          message: 'Username already taken',
          code: ERROR_CODES.USER_USERNAME_TAKEN,
        });
      }
    }

    const updates = {
      ...(data.displayName !== undefined
        ? { displayName: this.normalizeOptionalProfileText(data.displayName) }
        : {}),
      ...(data.bio !== undefined ? { bio: this.normalizeOptionalProfileText(data.bio) } : {}),
      ...(normalizedUsername !== undefined ? { username: normalizedUsername } : {}),
      updatedAt: new Date(),
    };

    try {
      const [user] = await this.db
        .update(users)
        .set(updates)
        .where(and(eq(users.id, id), isNull(users.deletedAt)))
        .returning({
          id: users.id,
          email: users.email,
          username: users.username,
          displayName: users.displayName,
          role: users.role,
          avatarUrl: users.avatarUrl,
          bio: users.bio,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return toUserProfile(user);
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        throw new ConflictException({
          message: 'Username already taken',
          code: ERROR_CODES.USER_USERNAME_TAKEN,
        });
      }

      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    await this.authService.revokeAllRefreshTokensForUser(id);

    const now = new Date();

    await this.db
      .update(users)
      .set({
        deletedAt: now,
        updatedAt: now,
      })
      .where(and(eq(users.id, id), isNull(users.deletedAt)));
  }

  private normalizeOptionalProfileText(value: string): string | null {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private async countRows(table: AnyPgTable, whereClause: SQL | undefined) {
    const [result] = await this.db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(table)
      .where(whereClause);

    return result?.count ?? 0;
  }

  private getStartOfUtcDay(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  private getNextUtcMidnight(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  }

  private toLimitMap(rows: Array<{ key: string; value: number }>): Record<string, number> {
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    if (typeof error !== 'object' || !error || !('code' in error)) {
      return false;
    }

    const dbError = error as { code?: string };
    return dbError.code === '23505';
  }
}
