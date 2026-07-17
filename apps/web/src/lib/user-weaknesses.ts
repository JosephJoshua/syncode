import { CONTROL_API, type UserWeaknessesResponse } from '@syncode/contracts';
import { api } from '@/lib/api-client.js';

export const USER_WEAKNESSES_QUERY_KEY = ['users', 'me', 'weaknesses'] as const;

export function fetchUserWeaknesses(): Promise<UserWeaknessesResponse> {
  return api(CONTROL_API.USERS.WEAKNESSES);
}

export function removeSessionFromUserWeaknesses(
  weaknesses: UserWeaknessesResponse,
  sessionId: string,
): UserWeaknessesResponse {
  return {
    data: weaknesses.data
      .map((weakness) => {
        const sessions = weakness.sessions.filter((session) => session.sessionId !== sessionId);

        return {
          ...weakness,
          frequency: sessions.length,
          sessions,
        };
      })
      .filter((weakness) => weakness.sessions.length > 0),
  };
}
