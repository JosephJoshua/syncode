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

/**
 * Handles all uncaught exceptions and transforms them into proper HTTP responses.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code: string | undefined;
    let details: unknown;

    (() => {
      if (exception instanceof ZodValidationException) {
        status = HttpStatus.BAD_REQUEST;
        message = 'Validation failed';
        code = ERROR_CODES.VALIDATION_FAILED;
        details = this.mapValidationDetails(exception.getZodError());
        return;
      }

      if (exception instanceof CircuitBreakerOpenError) {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message = 'Service temporarily unavailable';
        details = {
          circuit: exception.circuitName,
          retryAfter: exception.nextRetryAt,
        };

        this.logger.warn(
          `Circuit breaker open for ${exception.circuitName}, retry at ${exception.nextRetryAt}`,
        );
        return;
      }

      if (exception instanceof CircuitBreakerTimeoutError) {
        status = HttpStatus.GATEWAY_TIMEOUT;
        message = 'Operation timed out';
        details = {
          circuit: exception.circuitName,
          timeout: exception.timeoutMs,
        };

        this.logger.warn(
          `Circuit breaker timeout for ${exception.circuitName} (${exception.timeoutMs}ms)`,
        );
        return;
      }

      if (exception instanceof HttpException) {
        status = exception.getStatus();
        const exceptionResponse = exception.getResponse();

        if (typeof exceptionResponse === 'string') {
          message = exceptionResponse;
        } else {
          const res = exceptionResponse as Record<string, unknown>;
          message =
            typeof res.message === 'string'
              ? res.message
              : Array.isArray(res.message)
                ? res.message.join(', ')
                : exception.message;
          code = typeof res.code === 'string' ? res.code : undefined;
          details = res;
        }

        if (status >= 500) {
          this.logger.error(`HTTP ${status}: ${message}`, exception.stack);
        }

        return;
      }

      if (exception instanceof Error) {
        message = exception.message;

        this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
        return;
      }

      this.logger.error('Unknown exception type', exception);
    })();

    response.status(status).json({
      statusCode: status,
      ...(code ? { code } : {}),
      message,
      timestamp: new Date().toISOString(),
      ...(details ? { details } : {}),
    });
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
