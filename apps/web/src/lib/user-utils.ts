import type { AuthUserResponse } from '@syncode/contracts';

export function getUserInitial(user: AuthUserResponse | null): string | null {
  const source = user?.displayName || user?.username || user?.email;

  if (!source) {
    return null;
  }

  return source.trim().charAt(0).toUpperCase() || null;
}
