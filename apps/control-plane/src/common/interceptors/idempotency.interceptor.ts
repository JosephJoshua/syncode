import {
  BadRequestException,
  type CallHandler,
  ConflictException,
  type ExecutionContext,
  Inject,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ERROR_CODES } from '@syncode/contracts';
import type { Database } from '@syncode/db';
import { idempotencyKeys } from '@syncode/db';
import { IDEMPOTENCY_TTL_MS } from '@syncode/shared';
import { eq } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { from, type Observable, of } from 'rxjs';
import { catchError, mergeMap, switchMap } from 'rxjs/operators';
import { DB_CLIENT } from '@/modules/db/db.module.js';
import { IDEMPOTENT_KEY } from '../decorators/idempotent.decorator.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Deduplicates requests using the `Idempotency-Key` header.
 *
 * Only active on handlers decorated with {@link Idempotent}.
 * Uses the `idempotency_keys` database table for persistence.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject(DB_CLIENT) private readonly db: Database,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isIdempotent = this.reflector.get<boolean>(IDEMPOTENT_KEY, context.getHandler());
    if (!isIdempotent) return next.handle();

    const request = context.switchToHttp().getRequest<Request>();
    const rawKey = request.headers['idempotency-key'];
    if (!rawKey || Array.isArray(rawKey)) return next.handle();

    if (!UUID_REGEX.test(rawKey)) {
      throw new BadRequestException('Idempotency-Key must be a valid UUID');
    }

    const userId = (request as Request & { user?: { id: string } }).user?.id ?? null;
    const route = `${request.method}:${request.route?.path ?? request.path}`;
    const scopedKey = `${userId ?? 'anon'}:${route}:${rawKey}`;

    return from(this.acquireOrReturn(scopedKey, userId, context)).pipe(
      switchMap((cached) => {
        if (cached !== null) return of(cached);

        return next.handle().pipe(
          mergeMap((body) => {
            const res = context.switchToHttp().getResponse<Response>();
            return from(this.finalizeKey(scopedKey, res.statusCode, body)).pipe(
              switchMap(() => of(body)),
            );
          }),
          catchError((err) =>
            from(this.cleanupKey(scopedKey)).pipe(
              switchMap(() => {
                throw err;
              }),
            ),
          ),
        );
      }),
    );
  }

  private async acquireOrReturn(
    key: string,
    userId: string | null,
    context: ExecutionContext,
  ): Promise<unknown> {
    const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_MS);

    const inserted = await this.db
      .insert(idempotencyKeys)
      .values({ key, userId, statusCode: 0, expiresAt })
      .onConflictDoNothing()
      .returning();

    if (inserted.length > 0) return null; // We own the key

    const [existing] = await this.db
      .select()
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.key, key));

    if (!existing) return null; // Deleted between insert and select

    if (existing.expiresAt < new Date()) {
      // Delete the old key and re-insert so finalizeKey has a row to UPDATE
      await this.db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, key));
      await this.db
        .insert(idempotencyKeys)
        .values({ key, userId, statusCode: 0, expiresAt })
        .onConflictDoNothing();
      return null;
    }

    if (existing.responseBody === null) {
      throw new ConflictException({
        message: 'A request with this Idempotency-Key is already being processed',
        code: ERROR_CODES.IDEMPOTENCY_CONFLICT,
      });
    }

    this.logger.debug(`Returning cached response for idempotency key ${key}`);

    const res = context.switchToHttp().getResponse<Response>();
    res.status(existing.statusCode);

    return existing.responseBody;
  }

  private async finalizeKey(key: string, statusCode: number, body: unknown): Promise<void> {
    try {
      await this.db
        .update(idempotencyKeys)
        .set({ responseBody: body, statusCode })
        .where(eq(idempotencyKeys.key, key));
    } catch (error) {
      this.logger.warn(`Failed to finalize idempotency key ${key}`, error);
    }
  }

  private async cleanupKey(key: string): Promise<void> {
    try {
      await this.db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, key));
    } catch (error) {
      this.logger.warn(`Failed to clean up idempotency key ${key}`, error);
    }
  }
}
