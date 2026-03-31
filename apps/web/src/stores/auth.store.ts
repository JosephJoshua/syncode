import type { AuthUserResponse } from '@syncode/contracts';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type PersistedAuthState = Pick<AuthState, 'user' | 'accessToken'>;

interface AuthState {
  user: AuthUserResponse | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setSession: (session: { accessToken: string; user?: AuthUserResponse | null }) => void;
  setUser: (user: AuthUserResponse | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      setSession: ({ accessToken, user = null }) =>
        set({ user, accessToken, isAuthenticated: Boolean(accessToken) }),
      setUser: (user) => set({ user }),
      logout: () =>
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'syncode-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<PersistedAuthState>;
        const accessToken = persisted.accessToken ?? null;

        return {
          ...currentState,
          ...persisted,
          accessToken,
          isAuthenticated: Boolean(accessToken),
        };
      },
    },
  ),
);
