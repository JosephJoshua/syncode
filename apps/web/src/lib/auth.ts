import { CONTROL_API } from '@syncode/contracts';
import { redirect } from '@tanstack/react-router';
import { useAuthStore } from '@/stores/auth.store.js';
import { api } from './api-client.js';

/**
 * TanStack Router `beforeLoad` guard to redirect unauthenticated users to `/login`.
 */
export function requireAuth() {
  if (!useAuthStore.getState().isAuthenticated) {
    throw redirect({ to: '/login' });
  }
}

/**
 * TanStack Router `beforeLoad` guard to redirect authenticated users to `/dashboard`.
 */
export function requireGuest() {
  if (useAuthStore.getState().isAuthenticated) {
    throw redirect({ to: '/dashboard' });
  }
}

/**
 * Attempts to restore the session on page load by exchanging the HTTP-only
 * refresh-token cookie for a fresh access token, then fetching the user profile.
 */
export async function initializeAuth(): Promise<void> {
  try {
    const { accessToken } = await api(CONTROL_API.AUTH.REFRESH);
    useAuthStore.getState().setSession({ accessToken });

    try {
      const user = await api(CONTROL_API.USERS.PROFILE);
      useAuthStore.getState().setUser(user);
    } catch {
      // Profile fetch failed but we have a valid access token
    }
  } catch {
    // No valid refresh token, so user remains unauthenticated
  }
}
