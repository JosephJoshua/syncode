import type { UserProfileResponse } from '@syncode/contracts';
import { create } from 'zustand';

interface AuthState {
  user: UserProfileResponse | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setSession: (session: { accessToken: string; user?: UserProfileResponse | null }) => void;
  setUser: (user: UserProfileResponse | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  setSession: ({ accessToken, user }) =>
    set((state) => ({
      accessToken,
      isAuthenticated: true,
      user: user === undefined ? state.user : user,
    })),
  setUser: (user) => set({ user }),
  logout: () =>
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    }),
}));
