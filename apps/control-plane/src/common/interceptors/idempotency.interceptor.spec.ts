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

  const whereFnUpdate = vi.fn().mockResolvedValue(undefined);
  const setFn = vi.fn().mockReturnValue({ where: whereFnUpdate });
  const updateFn = vi.fn().mockReturnValue({ set: setFn });

  const whereFnDelete = vi.fn().mockResolvedValue(undefined);
  const deleteFn = vi.fn().mockReturnValue({ where: whereFnDelete });

  return {
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
    method: 'POST',
    path: '/rooms',
    route: { path: '/rooms' },
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

  it('GIVEN no @Idempotent metadata WHEN intercepting THEN passes through', async () => {
    const { reflector, context } = createMockContext({ hasMetadata: false });
    createInterceptor(reflector);

    const result = await lastValueFrom(interceptor.intercept(context, { handle: () => of('ok') }));

    expect(result).toBe('ok');
  });

  it('GIVEN no Idempotency-Key header WHEN intercepting THEN passes through', async () => {
    const { reflector, context } = createMockContext({
      hasMetadata: true,
      idempotencyKey: undefined,
    });
    createInterceptor(reflector);

    const result = await lastValueFrom(interceptor.intercept(context, { handle: () => of('ok') }));

    expect(result).toBe('ok');
  });

  it('GIVEN invalid UUID header WHEN intercepting THEN throws BadRequestException', () => {
    const { reflector, context } = createMockContext({
      hasMetadata: true,
      idempotencyKey: 'not-a-uuid',
    });
    createInterceptor(reflector);

    expect(() => interceptor.intercept(context, { handle: () => of('ok') })).toThrow(
      BadRequestException,
    );
  });

  it('GIVEN new key WHEN handler succeeds THEN returns response and caches it', async () => {
    const { reflector, context, mockResponse } = createMockContext({
      hasMetadata: true,
      idempotencyKey: VALID_UUID,
      userId: 'user-1',
    });
    dbSetup.mocks.insertReturning.mockResolvedValue([{ key: VALID_UUID }]);
    mockResponse.statusCode = 201;

    createInterceptor(reflector);
    const body = { roomId: 'room-1' };
    const result = await lastValueFrom(interceptor.intercept(context, { handle: () => of(body) }));

    expect(result).toEqual(body);
  });

  it('GIVEN completed key WHEN retried THEN returns cached response without calling handler', async () => {
    const { reflector, context, statusFn } = createMockContext({
      hasMetadata: true,
      idempotencyKey: VALID_UUID,
    });
    dbSetup.mocks.insertReturning.mockResolvedValue([]);
    dbSetup.mocks.selectWhere.mockResolvedValue([
      {
        key: VALID_UUID,
        responseBody: { cached: true },
        statusCode: 201,
        expiresAt: new Date(Date.now() + 86400000),
      },
    ]);

    createInterceptor(reflector);
    const handler = { handle: vi.fn(() => of('should not run')) };
    const result = await lastValueFrom(interceptor.intercept(context, handler));

    expect(result).toEqual({ cached: true });
    expect(statusFn).toHaveBeenCalledWith(201);
    expect(handler.handle).not.toHaveBeenCalled();
  });

  it('GIVEN in-progress key WHEN retried THEN throws ConflictException', async () => {
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

    await expect(
      lastValueFrom(interceptor.intercept(context, { handle: () => of({}) })),
    ).rejects.toThrow(ConflictException);
  });

  it('GIVEN handler error WHEN processing THEN cleans up key for retry', async () => {
    const { reflector, context } = createMockContext({
      hasMetadata: true,
      idempotencyKey: VALID_UUID,
    });
    dbSetup.mocks.insertReturning.mockResolvedValue([{ key: VALID_UUID }]);

    createInterceptor(reflector);

    await expect(
      lastValueFrom(
        interceptor.intercept(context, { handle: () => throwError(() => new Error('boom')) }),
      ),
    ).rejects.toThrow('boom');
  });

  it('GIVEN expired key WHEN retried THEN re-inserts and processes fresh request', async () => {
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

    createInterceptor(reflector);
    const result = await lastValueFrom(
      interceptor.intercept(context, { handle: () => of({ fresh: true }) }),
    );

    expect(result).toEqual({ fresh: true });
  });
});
