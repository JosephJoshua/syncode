import type { AuthUserResponse } from '@syncode/contracts';
import { create } from 'zustand';

interface AuthState {
  user: AuthUserResponse | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  setSession: (session: { accessToken: string; user?: AuthUserResponse | null }) => void;
  setUser: (user: AuthUserResponse | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  hasHydrated: true,
  setSession: ({ accessToken, user = null }) => set({ user, accessToken, isAuthenticated: true }),
  setUser: (user) => set({ user }),
  logout: () =>
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    }),
}));
