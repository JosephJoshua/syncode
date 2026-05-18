import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import {
  type AvatarUploadUrlResponse,
  ERROR_CODES,
  type PublicUserProfileResponse,
  type UpdateUserInput,
  type UserProfileResponse,
  type UserQuotasResponse,
  type UserWeaknessesResponse,
} from '@syncode/contracts';
import type { Database } from '@syncode/db';
import {
  aiHints,
  aiMessages,
  aiReviews,
  GLOBAL_LIMIT_KEYS,
  problems,
  rooms,
  runs,
  sessionDeletions,
  sessionParticipants,
  sessionReports,
  sessions,
  submissions,
  users,
  userWeaknesses,
  weaknessSessions,
} from '@syncode/db';
import { ROOM_STATUSES, RoomStatus } from '@syncode/shared';
import { type IStorageService, STORAGE_SERVICE } from '@syncode/shared/ports';
import { and, desc, eq, gte, inArray, isNull, ne, type SQL, sql } from 'drizzle-orm';
import type { AnyPgTable } from 'drizzle-orm/pg-core';
import { resolveAvatarUrls } from '@/common/resolve-avatar-urls.js';
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

  private static readonly AVATAR_KEY_PREFIX = 'avatars';
  private static readonly AVATAR_UPLOAD_URL_EXPIRY = 600; // 10 minutes

  constructor(
    @Inject(DB_CLIENT) private readonly db: Database,
    private readonly authService: AuthService,
    @Inject(STORAGE_SERVICE) private readonly storageService: IStorageService,
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

    return this.withResolvedAvatarUrl(toUserProfile(user));
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

    return this.withResolvedAvatarUrl(toPublicUserProfile(user));
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

    return this.withResolvedAvatarUrl(toUserProfile(user));
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

  async getWeaknesses(userId: string): Promise<UserWeaknessesResponse> {
    const weaknessRows = await this.db
      .select({
        id: userWeaknesses.id,
        category: userWeaknesses.category,
        description: userWeaknesses.description,
        frequency: userWeaknesses.frequency,
        trend: userWeaknesses.trend,
        lastSeenAt: userWeaknesses.lastSeenAt,
      })
      .from(userWeaknesses)
      .where(eq(userWeaknesses.userId, userId))
      .orderBy(desc(userWeaknesses.frequency), desc(userWeaknesses.lastSeenAt));

    if (weaknessRows.length === 0) {
      return { data: [] };
    }

    const weaknessIds = weaknessRows.map((weakness) => weakness.id);
    const linkedSessionRows = await this.db
      .select({
        weaknessId: weaknessSessions.weaknessId,
        sessionId: weaknessSessions.sessionId,
        description: weaknessSessions.description,
        trend: weaknessSessions.trend,
        problemName: problems.title,
        reportedAt: sql<Date>`COALESCE(${weaknessSessions.reportedAt}, ${sessionReports.generatedAt}, ${sessions.finishedAt}, ${sessions.startedAt})`,
        score: sql<
          number | null
        >`COALESCE(${weaknessSessions.score}, ${sessionReports.overallScore})`,
        startedAt: sessions.startedAt,
        finishedAt: sessions.finishedAt,
      })
      .from(weaknessSessions)
      .innerJoin(sessions, eq(sessions.id, weaknessSessions.sessionId))
      .innerJoin(
        sessionParticipants,
        and(eq(sessionParticipants.sessionId, sessions.id), eq(sessionParticipants.userId, userId)),
      )
      .leftJoin(
        sessionReports,
        and(
          eq(sessionReports.sessionId, sessions.id),
          eq(sessionReports.userId, userId),
          eq(sessionReports.status, 'completed'),
        ),
      )
      .leftJoin(problems, eq(problems.id, sessions.problemId))
      .leftJoin(
        sessionDeletions,
        and(
          eq(sessionDeletions.sessionId, weaknessSessions.sessionId),
          eq(sessionDeletions.userId, userId),
        ),
      )
      .where(
        and(
          inArray(weaknessSessions.weaknessId, weaknessIds),
          eq(sessions.status, 'finished'),
          isNull(sessionDeletions.userId),
        ),
      )
      .orderBy(
        desc(
          sql`COALESCE(${weaknessSessions.reportedAt}, ${sessionReports.generatedAt}, ${sessions.finishedAt}, ${sessions.startedAt})`,
        ),
      );

    const sessionsByWeakness = new Map<
      string,
      Array<{
        sessionId: string;
        description: string | null;
        trend: 'improving' | 'stable' | 'worsening' | null;
        problemName: string | null;
        reportedAt: string;
        score: number | null;
      }>
    >();

    for (const row of linkedSessionRows) {
      const currentSessions = sessionsByWeakness.get(row.weaknessId) ?? [];
      currentSessions.push({
        sessionId: row.sessionId,
        description: row.description,
        trend: row.trend,
        problemName: row.problemName,
        reportedAt: new Date(row.reportedAt).toISOString(),
        score: row.score ?? null,
      });
      sessionsByWeakness.set(row.weaknessId, currentSessions);
    }

    const visibleWeaknesses = weaknessRows
      .filter((weakness) => (sessionsByWeakness.get(weakness.id)?.length ?? 0) > 0)
      .sort((a, b) => {
        const frequencyDelta =
          (sessionsByWeakness.get(b.id)?.length ?? 0) - (sessionsByWeakness.get(a.id)?.length ?? 0);

        if (frequencyDelta !== 0) {
          return frequencyDelta;
        }

        return b.lastSeenAt.getTime() - a.lastSeenAt.getTime();
      });

    return {
      data: visibleWeaknesses.map((weakness) => {
        const linkedSessions = sessionsByWeakness.get(weakness.id) ?? [];
        const latestSession = linkedSessions[0];

        return {
          ...weakness,
          description: latestSession?.description ?? weakness.description,
          frequency: linkedSessions.length,
          trend: latestSession?.trend ?? weakness.trend,
          lastSeenAt: latestSession?.reportedAt ?? weakness.lastSeenAt.toISOString(),
          sessions: linkedSessions.map(({ sessionId, problemName, reportedAt, score }) => ({
            sessionId,
            problemName,
            reportedAt,
            score,
          })),
        };
      }),
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
      ...(data.displayName === undefined
        ? {}
        : { displayName: this.normalizeOptionalProfileText(data.displayName) }),
      ...(data.bio === undefined ? {} : { bio: this.normalizeOptionalProfileText(data.bio) }),
      ...(normalizedUsername === undefined ? {} : { username: normalizedUsername }),
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

      return this.withResolvedAvatarUrl(toUserProfile(user));
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

  async getAvatarUploadUrl(userId: string): Promise<AvatarUploadUrlResponse> {
    const key = `${UsersService.AVATAR_KEY_PREFIX}/${userId}.webp`;
    const uploadUrl = await this.storageService.getUploadUrl(key, {
      expiresInSeconds: UsersService.AVATAR_UPLOAD_URL_EXPIRY,
      contentType: 'image/webp',
    });

    return { uploadUrl, key };
  }

  async confirmAvatarUpload(userId: string): Promise<UserProfileResponse> {
    const key = `${UsersService.AVATAR_KEY_PREFIX}/${userId}.webp`;
    const objectExists = await this.storageService.exists(key);

    if (!objectExists) {
      throw new NotFoundException('Avatar not found in storage. Upload the file first.');
    }

    const [user] = await this.db
      .update(users)
      .set({ avatarUrl: key, updatedAt: new Date() })
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
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

    return this.withResolvedAvatarUrl(toUserProfile(user));
  }

  async deleteAvatar(userId: string): Promise<void> {
    const user = await this.db.query.users.findFirst({
      columns: { avatarUrl: true },
      where: (table) => and(eq(table.id, userId), isNull(table.deletedAt)),
    });

    if (user?.avatarUrl) {
      await this.storageService.delete(user.avatarUrl);
    }

    await this.db
      .update(users)
      .set({ avatarUrl: null, updatedAt: new Date() })
      .where(and(eq(users.id, userId), isNull(users.deletedAt)));
  }

  private async withResolvedAvatarUrl<T extends { avatarUrl: string | null }>(
    profile: T,
  ): Promise<T> {
    const [resolved] = (await resolveAvatarUrls([profile], this.storageService)) as [T];
    return resolved;
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
