import type { CircuitBreakerConfig } from '@syncode/shared/ports';
import type { CircuitBreakerAdapter } from './circuit-breaker.adapter.js';

/**
 * Configuration for a single method's circuit breaker protection
 */
export interface MethodCircuitConfig {
  /** Circuit breaker name (from DEFAULT_CIRCUIT_CONFIGS) */
  circuitName: string;
  /** Optional per-method circuit config overrides */
  config?: Partial<CircuitBreakerConfig>;
}

/**
 * Map of method names to their circuit breaker configurations
 */
export type AdapterCircuitConfig = Record<string, MethodCircuitConfig>;

/**
 * Creates a proxy that wraps specified methods with circuit breaker protection.
 *
 * IMPORTANT: Only async methods (returning Promise) are supported.
 * Sync methods cannot be protected by circuit breaker.
 *
 * @param target - The adapter instance to protect
 * @param circuitBreaker - Circuit breaker instance
 * @param methodConfigs - Map of method names to circuit configs
 * @returns Proxied adapter with circuit protection on specified methods
 */
export function createCircuitBreakerProxy<T extends object>(
  target: T,
  circuitBreaker: CircuitBreakerAdapter,
  methodConfigs: AdapterCircuitConfig,
): T {
  return new Proxy(target, {
    get(obj, prop) {
      const originalValue = obj[prop as keyof T];

      if (typeof prop === 'string' && typeof originalValue === 'function') {
        const methodConfig = methodConfigs[prop];

        if (methodConfig) {
          return function (this: T, ...args: unknown[]): Promise<unknown> {
            return circuitBreaker.execute(
              async () => {
                return await (originalValue as (...args: unknown[]) => Promise<unknown>).apply(
                  obj,
                  args,
                );
              },
              {
                name: methodConfig.circuitName,
                ...methodConfig.config,
              },
            );
          };
        }

        return (originalValue as (...args: unknown[]) => unknown).bind(obj);
      }

      // For non-function properties, return as-is
      return originalValue;
    },
  });
}
