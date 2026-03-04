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
    .string()
    .describe('User ID')
    .meta({ examples: ['clx1a2b3c'] }),
  email: z
    .string()
    .describe('Email address')
    .meta({ examples: ['user@example.com'] }),
  displayName: z
    .string()
    .optional()
    .describe('Display name')
    .meta({ examples: ['Jane Doe'] }),
  createdAt: z
    .string()
    .datetime()
    .describe('Account creation timestamp')
    .meta({ examples: ['2026-01-15T08:30:00.000Z'] }),
});

export type UserProfileResponse = z.infer<typeof userProfileResponseSchema>;
