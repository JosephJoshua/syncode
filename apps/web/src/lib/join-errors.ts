import { ERROR_CODES } from '@syncode/contracts';
import { type ApiErrorResult, type ErrorKeyMap, resolveErrorMessage } from '@/lib/api-client.js';

/**
 * Maps room-join errors to i18n keys. Keys live in the `rooms` namespace — callers
 * pass a `t` bound to that namespace so both `lobby.*` and `browse.*` resolve.
 */
export const JOIN_ERROR_KEYS: ErrorKeyMap = {
  [ERROR_CODES.ROOM_NOT_FOUND]: 'lobby.roomNotFound',
  [ERROR_CODES.ROOM_FULL]: 'lobby.roomFull',
  [ERROR_CODES.ROOM_FINISHED]: 'lobby.roomFinished',
  [ERROR_CODES.ROOM_INVALID_CODE]: 'lobby.invalidCode',
  [ERROR_CODES.ROOM_ACCESS_DENIED]: 'lobby.accessDenied',
  [ERROR_CODES.ROOM_PERMISSION_DENIED]: 'lobby.accessDenied',
  [ERROR_CODES.ROOM_INVITE_CODE_EXHAUSTED]: 'lobby.invalidCode',
  [ERROR_CODES.ROOM_ROLE_UNAVAILABLE]: 'lobby.roleUnavailable',
  [ERROR_CODES.ROOM_PARTICIPANT_REMOVED]: 'browse.joinRemoved',
};

/**
 * Resolves a join-related API error to a user-facing string. Falls back to
 * `lobby.joinFailed` when no mapped code matches — pass a different fallback if
 * the caller needs browse-specific copy.
 */
export function resolveJoinError(
  apiError: ApiErrorResult,
  t: (key: string) => string,
  fallbackKey = 'lobby.joinFailed',
): string {
  return resolveErrorMessage(apiError, JOIN_ERROR_KEYS, fallbackKey, t);
}
