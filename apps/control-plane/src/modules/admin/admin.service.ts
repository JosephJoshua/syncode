import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  type AdminBanUserInput,
  type AdminUser,
  type AdminUsersQuery,
  type AdminUsersResponse,
  ERROR_CODES,
} from '@syncode/contracts';
import type { Database } from '@syncode/db';
import { users } from '@syncode/db';
import { and, desc, eq, ilike, isNotNull, isNull, lt, or, type SQL } from 'drizzle-orm';
import { DB_CLIENT } from '@/modules/db/db.module.js';

interface UsersCursor {
  createdAt: string;
  id: string;
}

@Injectable()
export class AdminService {
  constructor(@Inject(DB_CLIENT) private readonly db: Database) {}

  async listUsers(actorId: string, query: AdminUsersQuery): Promise<AdminUsersResponse> {
    await this.assertAdmin(actorId);

    const limit = query.limit ?? 20;
    const filters = [
      isNull(users.deletedAt),
      this.buildSearchFilter(query.search),
      this.buildStatusFilter(query.status),
      this.buildCursorFilter(query.cursor),
    ].filter((item): item is SQL => Boolean(item));

    const rows = await this.db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        displayName: users.displayName,
        role: users.role,
        avatarUrl: users.avatarUrl,
        bannedAt: users.bannedAt,
        bannedReason: users.bannedReason,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(and(...filters))
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(limit + 1);

    const page = rows.slice(0, limit);
    const last = page.at(-1);

    return {
      data: page.map((row) => this.toAdminUser(row)),
      pagination: {
        hasMore: rows.length > limit,
        nextCursor:
          rows.length > limit && last
            ? this.encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
            : null,
      },
    };
  }

  async banUser(
    actorId: string,
    targetUserId: string,
    input: AdminBanUserInput,
  ): Promise<AdminUser> {
    await this.assertAdmin(actorId);

    const now = new Date();
    const [user] = await this.db
      .update(users)
      .set({
        bannedAt: now,
        bannedReason: input.reason?.trim() || null,
        updatedAt: now,
      })
      .where(and(eq(users.id, targetUserId), isNull(users.deletedAt)))
      .returning({
        id: users.id,
        email: users.email,
        username: users.username,
        displayName: users.displayName,
        role: users.role,
        avatarUrl: users.avatarUrl,
        bannedAt: users.bannedAt,
        bannedReason: users.bannedReason,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    if (!user) {
      throw new NotFoundException({
        message: 'User not found',
        code: ERROR_CODES.USER_NOT_FOUND,
      });
    }

    return this.toAdminUser(user);
  }

  async unbanUser(actorId: string, targetUserId: string): Promise<AdminUser> {
    await this.assertAdmin(actorId);

    const now = new Date();
    const [user] = await this.db
      .update(users)
      .set({
        bannedAt: null,
        bannedReason: null,
        updatedAt: now,
      })
      .where(and(eq(users.id, targetUserId), isNull(users.deletedAt)))
      .returning({
        id: users.id,
        email: users.email,
        username: users.username,
        displayName: users.displayName,
        role: users.role,
        avatarUrl: users.avatarUrl,
        bannedAt: users.bannedAt,
        bannedReason: users.bannedReason,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    if (!user) {
      throw new NotFoundException({
        message: 'User not found',
        code: ERROR_CODES.USER_NOT_FOUND,
      });
    }

    return this.toAdminUser(user);
  }

  private async assertAdmin(userId: string): Promise<void> {
    const actor = await this.db.query.users.findFirst({
      columns: { role: true, bannedAt: true },
      where: (table) => and(eq(table.id, userId), isNull(table.deletedAt)),
    });

    if (actor?.role !== 'admin' || actor.bannedAt) {
      throw new ForbiddenException({
        message: 'Admin access required',
        code: ERROR_CODES.FORBIDDEN,
      });
    }
  }

  private buildSearchFilter(search: string | undefined): SQL | undefined {
    const normalized = search?.trim();
    if (!normalized) {
      return undefined;
    }

    const pattern = `%${normalized}%`;
    return or(
      ilike(users.email, pattern),
      ilike(users.username, pattern),
      ilike(users.displayName, pattern),
    );
  }

  private buildStatusFilter(status: AdminUsersQuery['status']): SQL | undefined {
    if (status === 'active') {
      return isNull(users.bannedAt);
    }

    if (status === 'banned') {
      return isNotNull(users.bannedAt);
    }

    return undefined;
  }

  private buildCursorFilter(cursor: string | undefined): SQL | undefined {
    if (!cursor) {
      return undefined;
    }

    const decoded = this.decodeCursor(cursor);
    if (!decoded) {
      return undefined;
    }

    const createdAt = new Date(decoded.createdAt);
    return or(
      lt(users.createdAt, createdAt),
      and(eq(users.createdAt, createdAt), lt(users.id, decoded.id)),
    );
  }

  private toAdminUser(row: {
    id: string;
    email: string;
    username: string;
    displayName: string | null;
    role: 'user' | 'admin';
    avatarUrl: string | null;
    bannedAt: Date | null;
    bannedReason: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): AdminUser {
    return {
      ...row,
      bannedAt: row.bannedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private encodeCursor(cursor: UsersCursor): string {
    return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
  }

  private decodeCursor(cursor: string): UsersCursor | null {
    try {
      const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as UsersCursor;
      if (!parsed.createdAt || !parsed.id) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }
}
