import { Logger } from '@nestjs/common';
import {
  type CircuitBreakerConfig,
  type CircuitBreakerStats,
  CircuitState,
} from '@syncode/shared/ports';

/**
 * Circuit state machine managing state transitions and failure tracking
 */
export class Circuit {
  private readonly logger: Logger;
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private nextRetryAt: Date | null = null;
  private lastStateChange = new Date();
  private lastErrorMessage?: string;
  private lastErrorTime?: Date;

  // Metrics
  private totalCalls = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private totalTimeouts = 0;
  private totalRejections = 0;

  constructor(
    private readonly config: CircuitBreakerConfig,
    loggerContext: string,
  ) {
    this.logger = new Logger(`${loggerContext}:${config.name}`);
  }

  /**
   * Check if circuit allows execution
   * @returns true if request can proceed, false if circuit is open
   */
  canExecute(): boolean {
    if (this.state === CircuitState.CLOSED || this.state === CircuitState.HALF_OPEN) {
      return true;
    }

    if (this.state === CircuitState.OPEN && this.nextRetryAt && new Date() >= this.nextRetryAt) {
      this.transitionTo(CircuitState.HALF_OPEN);
      return true;
    }

    return false;
  }

  /**
   * Record successful operation
   */
  recordSuccess(): void {
    this.totalCalls++;
    this.totalSuccesses++;

    if (this.state === CircuitState.CLOSED) {
      this.failureCount = 0;
      return;
    }

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    }
  }

  /**
   * Record failed operation
   * @param error - Optional error to track for debugging
   */
  recordFailure(error?: Error): void {
    this.totalCalls++;
    this.totalFailures++;

    if (error) {
      this.lastErrorMessage = error.message;
      this.lastErrorTime = new Date();
    }

    if (this.state === CircuitState.CLOSED) {
      this.failureCount++;
      if (this.failureCount >= this.config.failureThreshold) {
        this.transitionTo(CircuitState.OPEN);
      }
    } else if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  /**
   * Record timeout (counts as failure)
   */
  recordTimeout(): void {
    this.totalTimeouts++;
    this.recordFailure();
  }

  /**
   * Record rejection (circuit was OPEN)
   */
  recordRejection(): void {
    this.totalRejections++;
  }

  /**
   * Get next retry time (only valid when circuit is OPEN)
   */
  getNextRetryAt(): Date | null {
    return this.nextRetryAt;
  }

  /**
   * Get last error message that caused circuit to trip
   *
   * Useful for debugging why circuit opened
   *
   * @returns Error message and timestamp, or undefined if no error recorded
   */
  getLastError(): { message: string; time: Date } | undefined {
    if (this.lastErrorMessage && this.lastErrorTime) {
      return { message: this.lastErrorMessage, time: this.lastErrorTime };
    }
    return undefined;
  }

  /**
   * Get current statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastStateChange: this.lastStateChange,
      totalCalls: this.totalCalls,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      totalTimeouts: this.totalTimeouts,
      totalRejections: this.totalRejections,
    };
  }

  /**
   * Manually reset circuit to CLOSED state
   */
  reset(): void {
    this.transitionTo(CircuitState.CLOSED);
  }

  /**
   * Transition to new state with side effects
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = new Date();

    if (newState === CircuitState.OPEN) {
      this.nextRetryAt = new Date(Date.now() + this.config.resetTimeoutMs);
      this.successCount = 0;
      this.logger.error(`Circuit opened: ${oldState} → OPEN`, {
        nextRetryAt: this.nextRetryAt.toISOString(),
        failureCount: this.failureCount,
        lastError: this.lastErrorMessage,
      });
    } else if (newState === CircuitState.CLOSED) {
      this.failureCount = 0;
      this.successCount = 0;
      this.nextRetryAt = null;
      this.lastErrorMessage = undefined;
      this.lastErrorTime = undefined;
      this.logger.log(`Circuit recovered: ${oldState} → CLOSED`);
    } else if (newState === CircuitState.HALF_OPEN) {
      this.failureCount = 0;
      this.successCount = 0;
      this.logger.warn(`Circuit testing recovery: ${oldState} → HALF_OPEN`);
    }
  }
}
