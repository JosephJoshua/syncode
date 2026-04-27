import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ERROR_CODES } from '@syncode/contracts';
import { CircuitBreakerOpenError, CircuitBreakerTimeoutError } from '@syncode/shared/ports';
import type { Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';

interface ErrorContext {
  status: number;
  message: string;
  code?: string;
  details?: unknown;
}

/**
 * Handles all uncaught exceptions and transforms them into proper HTTP responses.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, message, code, details } = this.resolveError(exception);

    response.status(status).json({
      statusCode: status,
      ...(code ? { code } : {}),
      message,
      timestamp: new Date().toISOString(),
      ...(details ? { details } : {}),
    });
  }

  private resolveError(exception: unknown): ErrorContext {
    if (exception instanceof ZodValidationException) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'Validation failed',
        code: ERROR_CODES.VALIDATION_FAILED,
        details: this.mapValidationDetails(exception.getZodError()),
      };
    }
    if (exception instanceof CircuitBreakerOpenError) {
      this.logger.warn(
        `Circuit breaker open for ${exception.circuitName}, retry at ${exception.nextRetryAt}`,
      );
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Service temporarily unavailable',
        details: { circuit: exception.circuitName, retryAfter: exception.nextRetryAt },
      };
    }
    if (exception instanceof CircuitBreakerTimeoutError) {
      this.logger.warn(
        `Circuit breaker timeout for ${exception.circuitName} (${exception.timeoutMs}ms)`,
      );
      return {
        status: HttpStatus.GATEWAY_TIMEOUT,
        message: 'Operation timed out',
        details: { circuit: exception.circuitName, timeout: exception.timeoutMs },
      };
    }
    if (exception instanceof HttpException) {
      return this.handleHttpException(exception);
    }
    if (exception instanceof Error) {
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
      return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: exception.message };
    }
    this.logger.error('Unknown exception type', exception);
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
  }

  private handleHttpException(exception: HttpException): ErrorContext {
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    const ctx = this.extractHttpContext(exceptionResponse, exception.message);

    if (status >= 500) {
      this.logger.error(`HTTP ${status}: ${ctx.message}`, exception.stack);
    }

    return { status, ...ctx };
  }

  private extractHttpContext(
    exceptionResponse: unknown,
    fallbackMessage: string,
  ): { message: string; code?: string; details?: unknown } {
    if (typeof exceptionResponse === 'string') {
      return { message: exceptionResponse };
    }
    const res = exceptionResponse as Record<string, unknown>;
    return {
      message: this.extractMessage(res, fallbackMessage),
      code: typeof res.code === 'string' ? res.code : undefined,
      details: res,
    };
  }

  private extractMessage(res: Record<string, unknown>, fallback: string): string {
    if (typeof res.message === 'string') return res.message;
    if (Array.isArray(res.message)) return res.message.join(', ');
    return fallback;
  }

  private mapValidationDetails(error: unknown): Record<string, string> {
    if (
      !error ||
      typeof error !== 'object' ||
      !('issues' in error) ||
      !Array.isArray(error.issues)
    ) {
      return {};
    }

    const details: Record<string, string> = {};

    for (const issue of error.issues) {
      if (!issue || typeof issue !== 'object') {
        continue;
      }

      const path = 'path' in issue && Array.isArray(issue.path) ? issue.path : [];
      const field = path.find((segment: unknown): segment is string => typeof segment === 'string');
      const message =
        'message' in issue && typeof issue.message === 'string' ? issue.message : null;

      if (field && message && !details[field]) {
        details[field] = message;
      }
    }

    return details;
  }
}
