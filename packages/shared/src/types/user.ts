export const UserRole = {
  USER: 'user',
  ADMIN: 'admin',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: UserRole;
  avatarUrl?: string;
  bio?: string;
  createdAt: Date;
  updatedAt: Date;
}
