import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { AuditService } from './audit.service.js';

interface UsersCursor {
  createdAt: string;
  id: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const adminUserSelection = {
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
};

@Injectable()
export class AdminService {
  constructor(
    @Inject(DB_CLIENT) private readonly db: Database,
    private readonly auditService: AuditService,
  ) {}

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
      .select(adminUserSelection)
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
    ipAddress?: string,
  ): Promise<AdminUser> {
    await this.assertAdmin(actorId);

    if (actorId === targetUserId) {
      throw new BadRequestException({
        message: 'Admins cannot ban their own account',
        code: ERROR_CODES.VALIDATION_FAILED,
      });
    }

    return this.db.transaction(async (tx) => {
      const now = new Date();
      const reason = input.reason?.trim() || null;
      const [user] = await tx
        .update(users)
        .set({
          bannedAt: now,
          bannedReason: reason,
          updatedAt: now,
        })
        .where(and(eq(users.id, targetUserId), isNull(users.deletedAt)))
        .returning(adminUserSelection);

      if (!user) {
        throw new NotFoundException({
          message: 'User not found',
          code: ERROR_CODES.USER_NOT_FOUND,
        });
      }

      await this.auditService.logWithClient(tx, {
        actorId,
        action: 'admin.user.ban',
        targetType: 'user',
        targetId: targetUserId,
        metadata: { reason },
        ipAddress,
      });

      return this.toAdminUser(user);
    });
  }

  async unbanUser(actorId: string, targetUserId: string, ipAddress?: string): Promise<AdminUser> {
    await this.assertAdmin(actorId);

    return this.db.transaction(async (tx) => {
      const now = new Date();
      const [user] = await tx
        .update(users)
        .set({
          bannedAt: null,
          bannedReason: null,
          updatedAt: now,
        })
        .where(and(eq(users.id, targetUserId), isNull(users.deletedAt)))
        .returning(adminUserSelection);

      if (!user) {
        throw new NotFoundException({
          message: 'User not found',
          code: ERROR_CODES.USER_NOT_FOUND,
        });
      }

      await this.auditService.logWithClient(tx, {
        actorId,
        action: 'admin.user.unban',
        targetType: 'user',
        targetId: targetUserId,
        ipAddress,
      });

      return this.toAdminUser(user);
    });
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

  private decodeCursor(cursor: string): UsersCursor {
    try {
      const buf = Buffer.from(cursor, 'base64url');
      if (buf.toString('base64url') !== cursor) {
        throw new Error('Cursor failed base64url round trip');
      }

      const parsed = JSON.parse(buf.toString('utf8')) as Partial<UsersCursor>;
      if (!this.isValidCursor(parsed)) {
        throw new Error('Cursor payload is invalid');
      }

      return { createdAt: parsed.createdAt, id: parsed.id };
    } catch {
      throw new BadRequestException({
        message: 'Invalid cursor',
        code: ERROR_CODES.VALIDATION_FAILED,
      });
    }
  }

  private isValidCursor(cursor: Partial<UsersCursor>): cursor is UsersCursor {
    if (typeof cursor.createdAt !== 'string' || typeof cursor.id !== 'string') {
      return false;
    }

    const createdAt = new Date(cursor.createdAt);
    return createdAt.toISOString() === cursor.createdAt && UUID_PATTERN.test(cursor.id);
  }
}
