import type { ExecutionContext } from '@nestjs/common';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Database } from '@syncode/db';
import { lastValueFrom, of, throwError } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor.js';

function createMockDb() {
  const returningFn = vi.fn();
  const onConflictDoNothingFn = vi.fn().mockReturnValue({ returning: returningFn });
  const valuesFn = vi.fn().mockReturnValue({ onConflictDoNothing: onConflictDoNothingFn });
  const insertFn = vi.fn().mockReturnValue({ values: valuesFn });

  const whereFnSelect = vi.fn();
  const fromFn = vi.fn().mockReturnValue({ where: whereFnSelect });
  const selectFn = vi.fn().mockReturnValue({ from: fromFn });

  const whereFnUpdate = vi.fn();
  const setFn = vi.fn().mockReturnValue({ where: whereFnUpdate });
  const updateFn = vi.fn().mockReturnValue({ set: setFn });

  const whereFnDelete = vi.fn();
  const deleteFn = vi.fn().mockReturnValue({ where: whereFnDelete });

  return {
    // biome-ignore lint/suspicious/noExplicitAny: partial mock of Drizzle Database
    db: {
      insert: insertFn,
      select: selectFn,
      update: updateFn,
      delete: deleteFn,
    } as unknown as Database,
    mocks: {
      insertReturning: returningFn,
      selectWhere: whereFnSelect,
      updateSet: setFn,
      updateWhere: whereFnUpdate,
      deleteWhere: whereFnDelete,
    },
  };
}

function createMockContext(opts: {
  hasMetadata?: boolean;
  idempotencyKey: string | string[] | undefined;
  userId?: string;
}) {
  const reflector = new Reflector();
  vi.spyOn(reflector, 'get').mockReturnValue(opts.hasMetadata ?? false);

  const statusFn = vi.fn();
  const mockRequest = {
    headers: {
      ...(opts.idempotencyKey === undefined ? {} : { 'idempotency-key': opts.idempotencyKey }),
    },
    user: opts.userId ? { id: opts.userId } : undefined,
  };
  const mockResponse = { statusCode: 201, status: statusFn };

  const context = {
    getHandler: vi.fn().mockReturnValue(() => {}),
    switchToHttp: vi.fn().mockReturnValue({
      getRequest: () => mockRequest,
      getResponse: () => mockResponse,
    }),
  } as unknown as ExecutionContext;

  return { reflector, context, statusFn, mockResponse };
}

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('IdempotencyInterceptor', () => {
  let dbSetup: ReturnType<typeof createMockDb>;
  let interceptor: IdempotencyInterceptor;

  beforeEach(() => {
    dbSetup = createMockDb();
  });

  function createInterceptor(reflector: Reflector) {
    interceptor = new IdempotencyInterceptor(reflector, dbSetup.db);
    return interceptor;
  }

  it('GIVEN no @Idempotent metadata WHEN intercepting THEN passes through without DB check', async () => {
    const { reflector, context } = createMockContext({ hasMetadata: false });
    createInterceptor(reflector);
    const handler = { handle: () => of({ ok: true }) };

    const result = await lastValueFrom(interceptor.intercept(context, handler));

    expect(result).toEqual({ ok: true });
  });

  it('GIVEN no Idempotency-Key header WHEN intercepting THEN passes through without DB check', async () => {
    const { reflector, context } = createMockContext({
      hasMetadata: true,
      idempotencyKey: undefined,
    });
    createInterceptor(reflector);
    const handler = { handle: () => of({ ok: true }) };

    const result = await lastValueFrom(interceptor.intercept(context, handler));

    expect(result).toEqual({ ok: true });
  });

  it('GIVEN array Idempotency-Key header WHEN intercepting THEN passes through without DB check', async () => {
    const { reflector, context } = createMockContext({
      hasMetadata: true,
      idempotencyKey: [VALID_UUID, VALID_UUID],
    });
    createInterceptor(reflector);
    const handler = { handle: () => of({ ok: true }) };

    const result = await lastValueFrom(interceptor.intercept(context, handler));

    expect(result).toEqual({ ok: true });
  });

  it('GIVEN invalid UUID header WHEN intercepting THEN throws BadRequestException', () => {
    const { reflector, context } = createMockContext({
      hasMetadata: true,
      idempotencyKey: 'not-a-uuid',
    });
    createInterceptor(reflector);
    const handler = { handle: () => of({ ok: true }) };

    expect(() => interceptor.intercept(context, handler)).toThrow(BadRequestException);
  });

  it('GIVEN new idempotency key WHEN handler succeeds THEN processes request and caches response', async () => {
    const { reflector, context, mockResponse } = createMockContext({
      hasMetadata: true,
      idempotencyKey: VALID_UUID,
      userId: 'user-1',
    });

    dbSetup.mocks.insertReturning.mockResolvedValue([{ key: VALID_UUID }]);

    createInterceptor(reflector);
    const responseBody = { roomId: 'room-1' };
    const handler = { handle: () => of(responseBody) };

    mockResponse.statusCode = 201;

    const result = await lastValueFrom(interceptor.intercept(context, handler));

    expect(result).toEqual(responseBody);

    await vi.waitFor(() => {
      expect(dbSetup.mocks.updateSet).toHaveBeenCalledWith({
        responseBody,
        statusCode: 201,
      });
    });
  });

  it('GIVEN completed idempotency key WHEN retried THEN returns cached response', async () => {
    const { reflector, context, statusFn } = createMockContext({
      hasMetadata: true,
      idempotencyKey: VALID_UUID,
    });

    dbSetup.mocks.insertReturning.mockResolvedValue([]);

    const cachedBody = { roomId: 'cached-room' };
    dbSetup.mocks.selectWhere.mockResolvedValue([
      {
        key: VALID_UUID,
        responseBody: cachedBody,
        statusCode: 201,
        expiresAt: new Date(Date.now() + 86400000),
      },
    ]);

    createInterceptor(reflector);
    const handler = { handle: vi.fn(() => of({ shouldNotBeCalled: true })) };

    const result = await lastValueFrom(interceptor.intercept(context, handler));

    expect(result).toEqual(cachedBody);
    expect(statusFn).toHaveBeenCalledWith(201);
    expect(handler.handle).not.toHaveBeenCalled();
  });

  it('GIVEN in-progress idempotency key WHEN retried THEN throws ConflictException', async () => {
    const { reflector, context } = createMockContext({
      hasMetadata: true,
      idempotencyKey: VALID_UUID,
    });

    dbSetup.mocks.insertReturning.mockResolvedValue([]);

    dbSetup.mocks.selectWhere.mockResolvedValue([
      {
        key: VALID_UUID,
        responseBody: null,
        statusCode: 0,
        expiresAt: new Date(Date.now() + 86400000),
      },
    ]);

    createInterceptor(reflector);
    const handler = { handle: () => of({}) };

    await expect(lastValueFrom(interceptor.intercept(context, handler))).rejects.toThrow(
      ConflictException,
    );
  });

  it('GIVEN new idempotency key WHEN handler throws THEN deletes key for retry', async () => {
    const { reflector, context } = createMockContext({
      hasMetadata: true,
      idempotencyKey: VALID_UUID,
    });

    dbSetup.mocks.insertReturning.mockResolvedValue([{ key: VALID_UUID }]);

    createInterceptor(reflector);
    const error = new Error('handler failed');
    const handler = { handle: () => throwError(() => error) };

    await expect(lastValueFrom(interceptor.intercept(context, handler))).rejects.toThrow(
      'handler failed',
    );

    expect(dbSetup.mocks.deleteWhere).toHaveBeenCalled();
  });

  it('GIVEN expired idempotency key WHEN retried THEN re-inserts key and processes request', async () => {
    const { reflector, context } = createMockContext({
      hasMetadata: true,
      idempotencyKey: VALID_UUID,
    });

    dbSetup.mocks.insertReturning.mockResolvedValue([]);

    dbSetup.mocks.selectWhere.mockResolvedValue([
      {
        key: VALID_UUID,
        responseBody: { old: true },
        statusCode: 201,
        expiresAt: new Date(Date.now() - 1000),
      },
    ]);

    dbSetup.mocks.deleteWhere.mockResolvedValue(undefined);

    createInterceptor(reflector);
    const responseBody = { fresh: true };
    const handler = { handle: () => of(responseBody) };

    const result = await lastValueFrom(interceptor.intercept(context, handler));

    expect(result).toEqual(responseBody);
  });
});
