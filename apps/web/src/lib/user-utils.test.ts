import type { UserProfileResponse } from '@syncode/contracts';
import { describe, expect, it } from 'vitest';
import { getUserDisplayName, getUserInitial } from './user-utils.js';

function createUser(overrides: Partial<UserProfileResponse>): UserProfileResponse {
  return {
    id: '497f6eca-6276-4993-bfeb-53cbbbba6f08',
    email: 'user@example.com',
    username: 'syncoder',
    displayName: null,
    role: 'user',
    avatarUrl: null,
    bio: null,
    stats: {
      totalSessions: 0,
      totalProblems: 0,
      streakDays: 0,
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('user utils', () => {
  it('prefers trimmed display name over username and email', () => {
    const user = createUser({
      displayName: '  Alice Doe  ',
      username: 'alice_sync',
      email: 'alice@example.com',
    });

    expect(getUserDisplayName(user)).toBe('Alice Doe');
    expect(getUserInitial(user)).toBe('A');
  });

  it('falls back to username when display name is empty', () => {
    const user = createUser({
      displayName: '   ',
      username: 'alice_sync',
      email: 'alice@example.com',
    });

    expect(getUserDisplayName(user)).toBe('alice_sync');
    expect(getUserInitial(user)).toBe('A');
  });

  it('falls back to the email prefix when no display name or username exists', () => {
    const user = createUser({
      displayName: null,
      username: '',
      email: 'alice@example.com',
    });

    expect(getUserDisplayName(user)).toBe('alice');
    expect(getUserInitial(user)).toBe('A');
  });

  it('returns null when no usable user identity exists', () => {
    expect(getUserDisplayName(null)).toBeNull();
    expect(getUserInitial(null)).toBeNull();
  });
});
