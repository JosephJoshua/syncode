import type { PublicUserProfileResponse, UserProfileResponse } from '@syncode/contracts';
import { users } from '@syncode/db';

type UserProfileRecord = Pick<
  typeof users.$inferSelect,
  | 'id'
  | 'email'
  | 'username'
  | 'displayName'
  | 'role'
  | 'avatarUrl'
  | 'bio'
  | 'createdAt'
  | 'updatedAt'
>;

type PublicUserProfileRecord = Pick<
  typeof users.$inferSelect,
  'id' | 'username' | 'displayName' | 'avatarUrl' | 'bio' | 'createdAt'
>;

export function toUserProfile(user: UserProfileRecord): UserProfileResponse {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName ?? null,
    role: user.role,
    avatarUrl: user.avatarUrl ?? null,
    bio: user.bio ?? null,
    // TODO: Compute real stats from sessions/submissions tables
    stats: {
      totalSessions: 0,
      totalProblems: 0,
      streakDays: 0,
    },
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function toPublicUserProfile(user: PublicUserProfileRecord): PublicUserProfileResponse {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName ?? null,
    avatarUrl: user.avatarUrl ?? null,
    bio: user.bio ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}
