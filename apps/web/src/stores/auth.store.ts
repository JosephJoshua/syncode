import type { UserProfile } from '@syncode/shared';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  setSession: (session: {
    accessToken: string;
    refreshToken?: string | null;
    user?: UserProfile | null;
  }) => void;
  setUser: (user: UserProfile | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  // TODO: access token in memory + refresh token in HttpOnly cookie instead
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      hasHydrated: false,
      setSession: ({ accessToken, refreshToken = null, user = null }) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),
      setUser: (user) => set({ user }),
      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'syncode-auth',
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ hasHydrated: true });
      },
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
