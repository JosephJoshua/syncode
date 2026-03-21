import { UserRole } from '@syncode/shared';
import { z } from 'zod';

export const updateUserSchema = z
  .object({
    displayName: z
      .string()
      .max(100)
      .optional()
      .describe('New display name')
      .meta({ examples: ['Jane Doe'] }),
  })
  .strict();

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const userProfileResponseSchema = z.object({
  id: z
    .uuid()
    .describe('User ID')
    .meta({ examples: ['497f6eca-6276-4993-bfeb-53cbbbba6f08'] }),
  email: z
    .email()
    .describe('Email address')
    .meta({ examples: ['user@example.com'] }),
  username: z
    .string()
    .describe('Username')
    .meta({ examples: ['syncoder_01'] }),
  displayName: z
    .string()
    .nullable()
    .describe('Display name')
    .meta({ examples: ['Jane Doe'] }),
  role: z
    .enum([UserRole.USER, UserRole.ADMIN])
    .describe('Global user role')
    .meta({ examples: [UserRole.USER] }),
  avatarUrl: z
    .string()
    .nullable()
    .describe('Avatar URL')
    .meta({ examples: ['https://cdn.syncode.app/avatar.png'] }),
  bio: z
    .string()
    .nullable()
    .describe('User bio')
    .meta({ examples: ['I love algorithms.'] }),
  stats: z.object({
    totalSessions: z.number().int().nonnegative(),
    totalProblems: z.number().int().nonnegative(),
    streakDays: z.number().int().nonnegative(),
  }),
  createdAt: z
    .string()
    .datetime()
    .describe('Account creation timestamp')
    .meta({ examples: ['2019-08-24T14:15:22.123Z'] }),
  updatedAt: z
    .string()
    .datetime()
    .describe('Last update timestamp')
    .meta({ examples: ['2019-08-24T14:15:22.123Z'] }),
});

export type UserProfileResponse = z.infer<typeof userProfileResponseSchema>;
