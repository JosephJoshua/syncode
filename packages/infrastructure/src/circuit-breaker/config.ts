import type { CircuitBreakerConfig } from '@syncode/shared/ports';

/**
 * Available circuit names
 */
export type CircuitName =
  | 's3-upload'
  | 's3-download'
  | 's3-presigned-url'
  | 's3-delete'
  | 's3-exists'
  | 's3-metadata'
  | 's3-list'
  | 's3-copy'
  | 'redis-incrby'
  | 'redis-set-if-not-exists'
  | 'redis-get'
  | 'redis-set'
  | 'redis-exists'
  | 'redis-del'
  | 'redis-del-pattern'
  | 'redis-get-ttl'
  | 'redis-expire'
  | 'livekit-generate-token'
  | 'livekit-create-room'
  | 'livekit-delete-room'
  | 'bullmq-enqueue'
  | 'bullmq-enqueue-bulk'
  | 'bullmq-get-job'
  | 'bullmq-get-stats'
  | 'collab-http-create'
  | 'collab-http-destroy'
  | 'collab-http-kick';

/**
 * Pre-configured circuit breaker settings for infrastructure adapters.
 */
export const DEFAULT_CIRCUIT_CONFIGS: Record<CircuitName, Omit<CircuitBreakerConfig, 'name'>> = {
  's3-upload': {
    failureThreshold: 5,
    successThreshold: 2,
    resetTimeoutMs: 30 * 1_000,
    operationTimeoutMs: 60 * 1_000,
  },
  's3-download': {
    failureThreshold: 5,
    successThreshold: 2,
    resetTimeoutMs: 30 * 1_000,
    operationTimeoutMs: 60 * 1_000,
  },
  's3-presigned-url': {
    failureThreshold: 3,
    successThreshold: 2,
    resetTimeoutMs: 15 * 1_000,
    operationTimeoutMs: 5 * 1_000,
  },
  's3-delete': {
    failureThreshold: 5,
    successThreshold: 2,
    resetTimeoutMs: 30 * 1_000,
    operationTimeoutMs: 30 * 1_000,
  },
  's3-exists': {
    failureThreshold: 3,
    successThreshold: 2,
    resetTimeoutMs: 15 * 1_000,
    operationTimeoutMs: 5 * 1_000,
  },
  's3-metadata': {
    failureThreshold: 3,
    successThreshold: 2,
    resetTimeoutMs: 15 * 1_000,
    operationTimeoutMs: 5 * 1_000,
  },
  's3-list': {
    failureThreshold: 5,
    successThreshold: 2,
    resetTimeoutMs: 30 * 1_000,
    operationTimeoutMs: 60 * 1_000,
  },
  's3-copy': {
    failureThreshold: 5,
    successThreshold: 2,
    resetTimeoutMs: 30 * 1_000,
    operationTimeoutMs: 60 * 1_000,
  },

  // Redis Cache Operations
  'redis-incrby': {
    failureThreshold: 3,
    successThreshold: 2,
    resetTimeoutMs: 5 * 1_000,
    operationTimeoutMs: 1_000,
  },
  'redis-set-if-not-exists': {
    failureThreshold: 3,
    successThreshold: 2,
    resetTimeoutMs: 5 * 1_000,
    operationTimeoutMs: 1_000,
  },
  'redis-get': {
    failureThreshold: 5,
    successThreshold: 2,
    resetTimeoutMs: 10 * 1_000,
    operationTimeoutMs: 2 * 1_000,
  },
  'redis-set': {
    failureThreshold: 5,
    successThreshold: 2,
    resetTimeoutMs: 10 * 1_000,
    operationTimeoutMs: 2 * 1_000,
  },
  'redis-exists': {
    failureThreshold: 5,
    successThreshold: 2,
    resetTimeoutMs: 10 * 1_000,
    operationTimeoutMs: 2 * 1_000,
  },
  'redis-del': {
    failureThreshold: 5,
    successThreshold: 2,
    resetTimeoutMs: 10 * 1_000,
    operationTimeoutMs: 2 * 1_000,
  },
  'redis-del-pattern': {
    failureThreshold: 5,
    successThreshold: 2,
    resetTimeoutMs: 10 * 1_000,
    operationTimeoutMs: 2 * 1_000,
  },
  'redis-get-ttl': {
    failureThreshold: 5,
    successThreshold: 2,
    resetTimeoutMs: 10 * 1_000,
    operationTimeoutMs: 2 * 1_000,
  },
  'redis-expire': {
    failureThreshold: 5,
    successThreshold: 2,
    resetTimeoutMs: 10 * 1_000,
    operationTimeoutMs: 2 * 1_000,
  },

  'livekit-generate-token': {
    failureThreshold: 3,
    successThreshold: 2,
    resetTimeoutMs: 10 * 1_000,
    operationTimeoutMs: 3 * 1_000,
  },
  'livekit-create-room': {
    failureThreshold: 5,
    successThreshold: 2,
    resetTimeoutMs: 20 * 1_000,
    operationTimeoutMs: 5 * 1_000,
  },
  'livekit-delete-room': {
    failureThreshold: 5,
    successThreshold: 2,
    resetTimeoutMs: 20 * 1_000,
    operationTimeoutMs: 5 * 1_000,
  },

  'bullmq-enqueue': {
    failureThreshold: 5,
    successThreshold: 2,
    resetTimeoutMs: 20 * 1_000,
    operationTimeoutMs: 10 * 1_000,
  },
  'bullmq-enqueue-bulk': {
    failureThreshold: 5,
    successThreshold: 2,
    resetTimeoutMs: 20 * 1_000,
    operationTimeoutMs: 15 * 1_000,
  },
  'bullmq-get-job': {
    failureThreshold: 5,
    successThreshold: 2,
    resetTimeoutMs: 10 * 1_000,
    operationTimeoutMs: 5 * 1_000,
  },
  'bullmq-get-stats': {
    failureThreshold: 5,
    successThreshold: 2,
    resetTimeoutMs: 10 * 1_000,
    operationTimeoutMs: 5 * 1_000,
  },

  'collab-http-create': {
    failureThreshold: 5,
    successThreshold: 2,
    resetTimeoutMs: 20 * 1_000,
    operationTimeoutMs: 10 * 1_000,
  },
  'collab-http-destroy': {
    failureThreshold: 5,
    successThreshold: 2,
    resetTimeoutMs: 20 * 1_000,
    operationTimeoutMs: 10 * 1_000,
  },
  'collab-http-kick': {
    failureThreshold: 5,
    successThreshold: 2,
    resetTimeoutMs: 20 * 1_000,
    operationTimeoutMs: 10 * 1_000,
  },
} as const;

/**
 * Get default config for a named circuit
 *
 * @param name - Circuit name
 * @returns Default configuration or undefined if not found
 */
export function getDefaultCircuitConfig(
  name: CircuitName,
): Omit<CircuitBreakerConfig, 'name'> | undefined {
  return DEFAULT_CIRCUIT_CONFIGS[name];
}
