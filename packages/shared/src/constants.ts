export const ROOM_LIMITS = {
  MAX_PARTICIPANTS: 8,
  MIN_PARTICIPANTS: 2,
  MAX_SPECTATORS: 5,
  ROOM_CODE_LENGTH: 6,
  IDLE_TIMEOUT_MS: 10 * 60 * 1_000,
  MAX_DURATION_MS: 2 * 60 * 60 * 1_000,
} as const;

export const EXECUTION_LIMITS = {
  TIMEOUT_MS: 30 * 1_000,
  MEMORY_MB: 512,
  MAX_OUTPUT_BYTES: 5 * 1_024 * 1_024,
  MAX_CONCURRENT_PER_USER: 3,
  QUEUE_TIMEOUT_MS: 60 * 1_000,
} as const;

export const RATE_LIMITS = {
  API_REQUESTS_PER_MINUTE: 100,
  EXECUTIONS_PER_MINUTE: 10,
  ROOM_JOINS_PER_MINUTE: 5,
  WS_MESSAGES_PER_SECOND: 50,
} as const;

export const SUPPORTED_LANGUAGES = [
  'python',
  'javascript',
  'typescript',
  'java',
  'cpp',
  'c',
  'go',
  'rust',
] as const;

export const EXECUTION_CONFIG = {
  RESULT_TTL_SECONDS: 10 * 60,
  STATUS_POLL_INTERVAL_MS: 100,
  MAX_POLL_DURATION_MS: 3 * 60 * 1_000,
  REDIS_KEY_PREFIX: 'execution',
} as const;
