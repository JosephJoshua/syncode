import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  type AdminAuditLogsQuery,
  type AdminAuditLogsResponse,
  type AuditLog,
  ERROR_CODES,
} from '@syncode/contracts';
import type { Database } from '@syncode/db';
import { auditLogs, users } from '@syncode/db';
import { and, desc, eq, gte, ilike, isNull, lt, lte, or, type SQL } from 'drizzle-orm';
import { DB_CLIENT } from '@/modules/db/db.module.js';

interface AuditCursor {
  createdAt: string;
  id: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AuditLogInput {
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: unknown;
  ipAddress?: string | null;
}

@Injectable()
export class AuditService {
  constructor(@Inject(DB_CLIENT) private readonly db: Database) {}

  async log(input: AuditLogInput): Promise<void> {
    await this.db.insert(auditLogs).values({
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata ?? null,
      ipAddress: input.ipAddress ?? null,
    });
  }

  async listLogs(actorId: string, query: AdminAuditLogsQuery): Promise<AdminAuditLogsResponse> {
    await this.assertAdmin(actorId);

    const limit = query.limit ?? 20;
    const filters = [
      this.buildSearchFilter(query.search),
      this.buildActionFilter(query.action),
      this.buildActorFilter(query.actorId),
      this.buildTargetFilter(query.targetId),
      this.buildDateFilter(query.from, query.to),
      this.buildCursorFilter(query.cursor),
    ].filter((item): item is SQL => Boolean(item));

    const rows = await this.db
      .select({
        id: auditLogs.id,
        actorId: auditLogs.actorId,
        action: auditLogs.action,
        targetType: auditLogs.targetType,
        targetId: auditLogs.targetId,
        metadata: auditLogs.metadata,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
        actorUsername: users.username,
        actorEmail: users.email,
        actorDisplayName: users.displayName,
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorId))
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(limit + 1);

    const page = rows.slice(0, limit);
    const last = page.at(-1);

    return {
      data: page.map((row) => this.toAuditLog(row)),
      pagination: {
        hasMore: rows.length > limit,
        nextCursor:
          rows.length > limit && last
            ? this.encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
            : null,
      },
    };
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
      ilike(auditLogs.action, pattern),
      ilike(auditLogs.targetType, pattern),
      ilike(auditLogs.targetId, pattern),
      ilike(users.email, pattern),
      ilike(users.username, pattern),
      ilike(users.displayName, pattern),
    );
  }

  private buildActionFilter(action: string | undefined): SQL | undefined {
    const normalized = action?.trim();
    return normalized ? eq(auditLogs.action, normalized) : undefined;
  }

  private buildActorFilter(actorId: string | undefined): SQL | undefined {
    return actorId ? eq(auditLogs.actorId, actorId) : undefined;
  }

  private buildTargetFilter(targetId: string | undefined): SQL | undefined {
    const normalized = targetId?.trim();
    return normalized ? eq(auditLogs.targetId, normalized) : undefined;
  }

  private buildDateFilter(from: string | undefined, to: string | undefined): SQL | undefined {
    const filters = [
      from ? gte(auditLogs.createdAt, new Date(from)) : undefined,
      to ? lte(auditLogs.createdAt, new Date(to)) : undefined,
    ].filter((item): item is SQL => Boolean(item));

    return filters.length > 0 ? and(...filters) : undefined;
  }

  private buildCursorFilter(cursor: string | undefined): SQL | undefined {
    if (!cursor) {
      return undefined;
    }

    const decoded = this.decodeCursor(cursor);
    const createdAt = new Date(decoded.createdAt);
    return or(
      lt(auditLogs.createdAt, createdAt),
      and(eq(auditLogs.createdAt, createdAt), lt(auditLogs.id, decoded.id)),
    );
  }

  private toAuditLog(row: {
    id: string;
    actorId: string | null;
    action: string;
    targetType: string;
    targetId: string;
    metadata: unknown;
    ipAddress: string | null;
    createdAt: Date;
    actorUsername: string | null;
    actorEmail: string | null;
    actorDisplayName: string | null;
  }): AuditLog {
    return {
      id: row.id,
      actorId: row.actorId,
      actor:
        row.actorId && row.actorEmail && row.actorUsername
          ? {
              id: row.actorId,
              username: row.actorUsername,
              email: row.actorEmail,
              displayName: row.actorDisplayName,
            }
          : null,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      metadata: row.metadata ?? null,
      ipAddress: row.ipAddress,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private encodeCursor(cursor: AuditCursor): string {
    return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
  }

  private decodeCursor(cursor: string): AuditCursor {
    try {
      const buf = Buffer.from(cursor, 'base64url');
      if (buf.toString('base64url') !== cursor) {
        throw new Error('Cursor failed base64url round trip');
      }

      const parsed = JSON.parse(buf.toString('utf8')) as Partial<AuditCursor>;
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

  private isValidCursor(cursor: Partial<AuditCursor>): cursor is AuditCursor {
    if (typeof cursor.createdAt !== 'string' || typeof cursor.id !== 'string') {
      return false;
    }

    const createdAt = new Date(cursor.createdAt);
    return createdAt.toISOString() === cursor.createdAt && UUID_PATTERN.test(cursor.id);
  }
}
