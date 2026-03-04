/**
 * Circuit state machine states
 */
export enum CircuitState {
  /** Normal operation (requests pass through) */
  CLOSED = 'CLOSED',
  /** Service unhealthy (fail fast without calling downstream) */
  OPEN = 'OPEN',
  /** Testing if service recovered; limited requests allowed */
  HALF_OPEN = 'HALF_OPEN',
}

/**
 * Configuration for a circuit breaker instance
 */
export interface CircuitBreakerConfig {
  /** Unique identifier for this circuit */
  name: string;
  /** Number of consecutive failures before opening circuit */
  failureThreshold: number;
  /** Number of consecutive successes to close from HALF_OPEN */
  successThreshold: number;
  /** Milliseconds to wait before testing recovery (OPEN -> HALF_OPEN) */
  resetTimeoutMs: number;
  /** Optional timeout for operations wrapped by circuit breaker */
  operationTimeoutMs?: number;
}

/**
 * Circuit breaker statistics for monitoring
 */
export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastStateChange: Date;
  totalCalls: number;
  totalFailures: number;
  totalSuccesses: number;
  totalTimeouts: number;
  totalRejections: number;
}

/**
 * Thrown when circuit is OPEN and rejects requests
 */
export class CircuitBreakerOpenError extends Error {
  constructor(
    public readonly circuitName: string,
    public readonly nextRetryAt: Date,
    public readonly lastFailure?: Error,
  ) {
    const baseMessage = `Circuit '${circuitName}' is OPEN. Next retry: ${nextRetryAt.toISOString()}`;
    const causeMessage = lastFailure ? `\nLast failure: ${lastFailure.message}` : '';

    super(baseMessage + causeMessage);
    this.name = 'CircuitBreakerOpenError';
    this.cause = lastFailure;
  }
}

/**
 * Thrown when operation exceeds configured timeout
 */
export class CircuitBreakerTimeoutError extends Error {
  constructor(
    public readonly circuitName: string,
    public readonly timeoutMs: number,
  ) {
    super(`Circuit '${circuitName}' timed out after ${timeoutMs}ms`);
    this.name = 'CircuitBreakerTimeoutError';
  }
}
