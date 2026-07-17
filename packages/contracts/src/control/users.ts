import { UserRole, WEAKNESS_CATEGORIES, WEAKNESS_TRENDS } from '@syncode/shared';
import { z } from 'zod';

export const USER_WEAKNESS_CATEGORIES = WEAKNESS_CATEGORIES;

export const USER_WEAKNESS_TRENDS = WEAKNESS_TRENDS;

export const updateUserSchema = z
  .object({
    displayName: z
      .string()
      .max(100)
      .optional()
      .describe('New display name')
      .meta({ examples: ['Jane Doe'] }),
    bio: z
      .string()
      .max(500)
      .optional()
      .describe('New biography')
      .meta({ examples: ['I love algorithms.'] }),
    username: z
      .string()
      .min(3)
      .max(30)
      .regex(/^\w+$/)
      .optional()
      .describe('New username')
      .meta({ examples: ['syncoder_01'] }),
  })
  .strict();

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const userStatsSchema = z.object({
  totalSessions: z.number().int().nonnegative(),
  totalProblems: z.number().int().nonnegative(),
  streakDays: z.number().int().nonnegative(),
});

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
  stats: userStatsSchema,
  createdAt: z.iso
    .datetime()
    .describe('Account creation timestamp')
    .meta({ examples: ['2019-08-24T14:15:22.123Z'] }),
  updatedAt: z.iso
    .datetime()
    .describe('Last update timestamp')
    .meta({ examples: ['2019-08-24T14:15:22.123Z'] }),
});

export type UserProfileResponse = z.infer<typeof userProfileResponseSchema>;

export const publicUserProfileResponseSchema = z.object({
  id: z
    .uuid()
    .describe('User ID')
    .meta({ examples: ['497f6eca-6276-4993-bfeb-53cbbbba6f08'] }),
  username: z
    .string()
    .describe('Username')
    .meta({ examples: ['syncoder_01'] }),
  displayName: z
    .string()
    .nullable()
    .describe('Display name')
    .meta({ examples: ['Jane Doe'] }),
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
  createdAt: z.iso
    .datetime()
    .describe('Account creation timestamp')
    .meta({ examples: ['2019-08-24T14:15:22.123Z'] }),
});

export type PublicUserProfileResponse = z.infer<typeof publicUserProfileResponseSchema>;

export const dailyUsageQuotaSchema = z.object({
  used: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
  resetsAt: z.iso.datetime(),
});

export const roomsQuotaSchema = z.object({
  activeCount: z.number().int().nonnegative(),
  maxActive: z.number().int().nonnegative(),
});

export const userQuotasResponseSchema = z.object({
  ai: dailyUsageQuotaSchema,
  execution: dailyUsageQuotaSchema,
  rooms: roomsQuotaSchema,
});

export type UserQuotasResponse = z.infer<typeof userQuotasResponseSchema>;

export const userWeaknessSessionSchema = z.object({
  sessionId: z.uuid(),
  problemName: z.string().nullable(),
  reportedAt: z.iso.datetime(),
  score: z.number().int().min(0).max(100).nullable(),
});

export const userWeaknessSchema = z.object({
  id: z.uuid(),
  category: z.enum(USER_WEAKNESS_CATEGORIES),
  description: z.string(),
  frequency: z.number().int().nonnegative(),
  trend: z.enum(USER_WEAKNESS_TRENDS),
  lastSeenAt: z.iso.datetime(),
  sessions: z.array(userWeaknessSessionSchema).default([]),
});

export const userWeaknessesResponseSchema = z.object({
  data: z.array(userWeaknessSchema).default([]),
});

export type UserWeakness = z.infer<typeof userWeaknessSchema>;
export type UserWeaknessesResponse = z.infer<typeof userWeaknessesResponseSchema>;

export const avatarUploadUrlResponseSchema = z.object({
  uploadUrl: z.string().describe('Presigned PUT URL for direct S3 upload'),
  key: z.string().describe('S3 object key for the avatar'),
});

export type AvatarUploadUrlResponse = z.infer<typeof avatarUploadUrlResponseSchema>;
