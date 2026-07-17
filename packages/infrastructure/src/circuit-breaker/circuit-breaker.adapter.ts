import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import {
  type CircuitBreakerConfig,
  CircuitBreakerOpenError,
  type CircuitBreakerStats,
  CircuitBreakerTimeoutError,
} from '@syncode/shared/ports';
import { Circuit } from './circuit-state.js';
import { type CircuitName, DEFAULT_CIRCUIT_CONFIGS } from './config.js';

/**
 * Fallback configuration values (when no default found)
 */
const FALLBACK_FAILURE_THRESHOLD = 5;
const FALLBACK_SUCCESS_THRESHOLD = 2;
const FALLBACK_RESET_TIMEOUT_MS = 30000;

/**
 * Maximum number of circuits to prevent memory leaks from dynamic names
 */
const MAX_CIRCUITS = 100;

/**
 * Protects infrastructure operations from cascading failures by tracking
 * failure rates and failing fast when services are unhealthy.
 *
 * Used internally by factory functions to wrap adapter methods with
 * circuit breaker protection via proxy pattern.
 */
@Injectable()
export class CircuitBreakerAdapter implements OnModuleDestroy {
  /**
   * Circuit registry. Maps circuit names to Circuit instances.
   *
   * @see DEFAULT_CIRCUIT_CONFIGS for pre-configured circuit names
   */
  private readonly circuits = new Map<string, Circuit>();

  async execute<T>(fn: () => Promise<T>, config?: Partial<CircuitBreakerConfig>): Promise<T> {
    if (!config?.name) {
      throw new Error('Circuit breaker config must include a name');
    }

    const circuit = this.getOrCreateCircuit(config.name, config);

    if (!circuit.canExecute()) {
      circuit.recordRejection();
      const nextRetryAt = circuit.getNextRetryAt();
      if (!nextRetryAt) {
        throw new Error(`Circuit '${config.name}' is in invalid state: OPEN without nextRetryAt`);
      }

      const lastErrorInfo = circuit.getLastError();
      const lastError = lastErrorInfo ? new Error(lastErrorInfo.message) : undefined;

      throw new CircuitBreakerOpenError(config.name, nextRetryAt, lastError);
    }

    try {
      const result = config.operationTimeoutMs
        ? await this.withTimeout(fn, config.operationTimeoutMs, config.name)
        : await fn();

      circuit.recordSuccess();
      return result;
    } catch (error) {
      if (error instanceof CircuitBreakerTimeoutError) {
        circuit.recordTimeout();
      } else {
        circuit.recordFailure(error instanceof Error ? error : undefined);
      }
      throw error;
    }
  }

  private async withTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    circuitName: string,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let settled = false;

      const timeoutHandle = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new CircuitBreakerTimeoutError(circuitName, timeoutMs));
        }
      }, timeoutMs);

      fn()
        .then((result) => {
          if (!settled) {
            settled = true;
            clearTimeout(timeoutHandle);
            resolve(result);
          }
        })
        .catch((error) => {
          if (!settled) {
            settled = true;
            clearTimeout(timeoutHandle);
            reject(error);
          }
        });
    });
  }

  private getOrCreateCircuit(name: string, partialConfig?: Partial<CircuitBreakerConfig>): Circuit {
    let circuit = this.circuits.get(name);
    if (!circuit) {
      if (this.circuits.size >= MAX_CIRCUITS) {
        throw new Error(
          `Circuit limit reached (${MAX_CIRCUITS}). ` +
            `Do not use dynamic circuit names (e.g., user-specific circuits).`,
        );
      }

      const defaultConfig = DEFAULT_CIRCUIT_CONFIGS[name as CircuitName] || {};

      const fullConfig: CircuitBreakerConfig = {
        name,
        failureThreshold:
          partialConfig?.failureThreshold ??
          defaultConfig.failureThreshold ??
          FALLBACK_FAILURE_THRESHOLD,
        successThreshold:
          partialConfig?.successThreshold ??
          defaultConfig.successThreshold ??
          FALLBACK_SUCCESS_THRESHOLD,
        resetTimeoutMs:
          partialConfig?.resetTimeoutMs ??
          defaultConfig.resetTimeoutMs ??
          FALLBACK_RESET_TIMEOUT_MS,
        operationTimeoutMs: partialConfig?.operationTimeoutMs ?? defaultConfig.operationTimeoutMs,
      };

      if (fullConfig.failureThreshold <= 0) {
        throw new Error(
          `Invalid failureThreshold: ${fullConfig.failureThreshold}. Must be positive.`,
        );
      }
      if (fullConfig.successThreshold <= 0) {
        throw new Error(
          `Invalid successThreshold: ${fullConfig.successThreshold}. Must be positive.`,
        );
      }
      if (fullConfig.resetTimeoutMs <= 0) {
        throw new Error(`Invalid resetTimeoutMs: ${fullConfig.resetTimeoutMs}. Must be positive.`);
      }
      if (fullConfig.operationTimeoutMs !== undefined && fullConfig.operationTimeoutMs <= 0) {
        throw new Error(
          `Invalid operationTimeoutMs: ${fullConfig.operationTimeoutMs}. Must be positive.`,
        );
      }

      circuit = new Circuit(fullConfig, CircuitBreakerAdapter.name);
      this.circuits.set(name, circuit);
    }
    return circuit;
  }

  /**
   * Get current statistics for a circuit.
   *
   * @param name - Circuit name
   * @returns Stats if circuit exists, null otherwise
   */
  getStats(name: string): CircuitBreakerStats | null {
    return this.circuits.get(name)?.getStats() ?? null;
  }

  /**
   * Get statistics for all circuits.
   *
   * @returns Map of circuit name to stats
   */
  getAllStats(): Map<string, CircuitBreakerStats> {
    const stats = new Map<string, CircuitBreakerStats>();
    for (const [name, circuit] of this.circuits) {
      stats.set(name, circuit.getStats());
    }
    return stats;
  }

  /**
   * Manually reset a circuit to CLOSED state.
   *
   * Use this to force recovery if you know the service is healthy.
   *
   * @param name - Circuit name to reset
   */
  reset(name: string): void {
    this.circuits.get(name)?.reset();
  }

  /**
   * Cleanup all circuits on shutdown.
   *
   * Called automatically by NestJS when module is destroyed.
   */
  async shutdown(): Promise<void> {
    this.circuits.clear();
  }

  async onModuleDestroy(): Promise<void> {
    await this.shutdown();
  }
}
