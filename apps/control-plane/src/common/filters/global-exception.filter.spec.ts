import { HttpException, HttpStatus } from '@nestjs/common';
import { CircuitBreakerOpenError, CircuitBreakerTimeoutError } from '@syncode/shared/ports';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { GlobalExceptionFilter } from './global-exception.filter';

function createMockHost(mockResponse: {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
}) {
  return {
    switchToHttp: () => ({
      getResponse: () => mockResponse,
    }),
  } as any;
}

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockJson: ReturnType<typeof vi.fn>;
  let mockStatus: ReturnType<typeof vi.fn>;
  let mockHost: any;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    mockJson = vi.fn();
    mockStatus = vi.fn().mockReturnValue({ json: mockJson });
    mockHost = createMockHost({ status: mockStatus, json: mockJson });
  });

  test('GIVEN CircuitBreakerOpenError WHEN caught THEN responds with 503 and circuit details', () => {
    const nextRetry = new Date('2025-01-01T00:00:00Z');
    const error = new CircuitBreakerOpenError('redis', nextRetry);

    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Service temporarily unavailable',
        details: {
          circuit: 'redis',
          retryAfter: nextRetry,
        },
      }),
    );
  });

  test('GIVEN CircuitBreakerTimeoutError WHEN caught THEN responds with 504 and timeout details', () => {
    const error = new CircuitBreakerTimeoutError('s3', 5000);

    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.GATEWAY_TIMEOUT);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.GATEWAY_TIMEOUT,
        message: 'Operation timed out',
        details: {
          circuit: 's3',
          timeout: 5000,
        },
      }),
    );
  });

  test('GIVEN HttpException with string response WHEN caught THEN uses string as message', () => {
    const error = new HttpException('Not Found', HttpStatus.NOT_FOUND);

    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Not Found',
      }),
    );
  });

  test('GIVEN HttpException with object response WHEN caught THEN extracts message and includes details', () => {
    const error = new HttpException(
      { message: 'Validation failed', errors: ['field required'] },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Validation failed',
        details: expect.objectContaining({ message: 'Validation failed' }),
      }),
    );
  });

  test('GIVEN HttpException with 500+ status WHEN caught THEN still returns proper error shape', () => {
    const error = new HttpException('DB down', HttpStatus.INTERNAL_SERVER_ERROR);

    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'DB down',
      }),
    );
  });

  test('GIVEN plain Error WHEN caught THEN responds with 500 and error message', () => {
    const error = new Error('Something broke');

    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Something broke',
      }),
    );
  });

  test('GIVEN unknown non-Error value WHEN caught THEN responds with 500 and default message', () => {
    filter.catch('random string', mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      }),
    );
  });

  test('GIVEN any exception WHEN caught THEN response always includes timestamp', () => {
    filter.catch(new Error('test'), mockHost);

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      }),
    );
  });

  test('GIVEN non-circuit-breaker exception WHEN caught THEN response has no details field', () => {
    filter.catch(new Error('simple error'), mockHost);

    expect(mockJson).toHaveBeenCalledWith(
      expect.not.objectContaining({ details: expect.anything() }),
    );
  });
});
