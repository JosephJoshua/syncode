import {
  BULLMQ_ADAPTER_CIRCUIT_CONFIG,
  COLLAB_CLIENT_CIRCUIT_CONFIG,
  LIVEKIT_ADAPTER_CIRCUIT_CONFIG,
  REDIS_ADAPTER_CIRCUIT_CONFIG,
  S3_ADAPTER_CIRCUIT_CONFIG,
} from './adapter-configs.js';
import type { CircuitBreakerAdapter } from './circuit-breaker.adapter.js';
import { createCircuitBreakerProxy } from './proxy.js';

/**
 * Creates an S3 storage adapter with circuit breaker protection.
 */
export function createProtectedS3Adapter<T extends object>(
  adapter: T,
  circuitBreaker: CircuitBreakerAdapter,
): T {
  return createCircuitBreakerProxy(adapter, circuitBreaker, S3_ADAPTER_CIRCUIT_CONFIG);
}

/**
 * Creates a Redis cache adapter with circuit breaker protection.
 */
export function createProtectedRedisAdapter<T extends object>(
  adapter: T,
  circuitBreaker: CircuitBreakerAdapter,
): T {
  return createCircuitBreakerProxy(adapter, circuitBreaker, REDIS_ADAPTER_CIRCUIT_CONFIG);
}

/**
 * Creates a LiveKit media adapter with circuit breaker protection.
 */
export function createProtectedLiveKitAdapter<T extends object>(
  adapter: T,
  circuitBreaker: CircuitBreakerAdapter,
): T {
  return createCircuitBreakerProxy(adapter, circuitBreaker, LIVEKIT_ADAPTER_CIRCUIT_CONFIG);
}

/**
 * Creates a BullMQ queue adapter with circuit breaker protection.
 */
export function createProtectedBullMqAdapter<T extends object>(
  adapter: T,
  circuitBreaker: CircuitBreakerAdapter,
): T {
  return createCircuitBreakerProxy(adapter, circuitBreaker, BULLMQ_ADAPTER_CIRCUIT_CONFIG);
}

/**
 * Creates a collab HTTP client with circuit breaker protection.
 */
export function createProtectedCollabClient<T extends object>(
  adapter: T,
  circuitBreaker: CircuitBreakerAdapter,
): T {
  return createCircuitBreakerProxy(adapter, circuitBreaker, COLLAB_CLIENT_CIRCUIT_CONFIG);
}
