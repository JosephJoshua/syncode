export interface UserProfile {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  role: 'user' | 'admin';
  avatarUrl: string | null;
  bio: string | null;
  stats: {
    totalSessions: number;
    totalProblems: number;
    streakDays: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface UserProfileRecord {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  role: 'user' | 'admin';
  avatarUrl: string | null;
  bio: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toUserProfile(user: UserProfileRecord): UserProfile {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName ?? null,
    role: user.role,
    avatarUrl: user.avatarUrl ?? null,
    bio: user.bio ?? null,
    stats: {
      totalSessions: 0,
      totalProblems: 0,
      streakDays: 0,
    },
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
