import type { UserProfileResponse } from '@syncode/contracts';

export function getUserDisplayName(user: UserProfileResponse | null): string | null {
  if (user?.displayName?.trim()) {
    return user.displayName.trim();
  }

  if (user?.username?.trim()) {
    return user.username.trim();
  }

  if (user?.email?.trim()) {
    return user.email.split('@')[0]?.trim() || null;
  }

  return null;
}

export function getUserInitial(user: UserProfileResponse | null): string | null {
  const source = getUserDisplayName(user) ?? user?.email;

  if (!source) {
    return null;
  }

  return source.trim().charAt(0).toUpperCase() || null;
}
