export const ROOM_LIMITS = {
  MAX_PARTICIPANTS: 8,
  MIN_PARTICIPANTS: 2,
  MAX_OBSERVERS: 5,
  ROOM_CODE_LENGTH: 6,
  IDLE_TIMEOUT_MS: 10 * 60 * 1_000,
  MAX_DURATION_MS: 2 * 60 * 60 * 1_000,
} as const;

export const RATE_LIMITS = {
  API_REQUESTS_PER_MINUTE: 100,
  EXECUTIONS_PER_MINUTE: 10,
  ROOM_JOINS_PER_MINUTE: 5,
  WS_MESSAGES_PER_SECOND: 50,
} as const;

export const INVITE_CODE_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 6;
export const INVITE_CODE_MAX_RETRIES = 5;
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1_000;

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
