import { UserRole } from '@syncode/shared';
import { z } from 'zod';

export const registerSchema = z
  .object({
    username: z
      .string()
      .min(3)
      .max(30)
      .regex(/^[a-zA-Z0-9_]+$/)
      .describe('Username (3-30 chars, letters/numbers/underscore)')
      .meta({ examples: ['syncoder_01'] }),
    email: z
      .email()
      .describe('Email address')
      .meta({ examples: ['user@example.com'] }),
    password: z
      .string()
      .min(8)
      .describe('Password (min 8 characters)')
      .meta({ examples: ['P@ssw0rd!'] }),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;

export const registerResponseSchema = z.object({
  userId: z
    .string()
    .describe('Created user ID')
    .meta({ examples: ['f47ac10b-58cc-4372-a567-0e02b2c3d479'] }),
});

export type RegisterResponse = z.infer<typeof registerResponseSchema>;

export const loginSchema = z
  .object({
    identifier: z
      .string()
      .min(1)
      .describe('Email address or username')
      .meta({ examples: ['user@example.com'] }),
    password: z
      .string()
      .min(1)
      .describe('Password')
      .meta({ examples: ['P@ssw0rd!'] }),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;

export const refreshTokenSchema = z
  .object({
    refreshToken: z
      .string()
      .min(1)
      .describe('JWT refresh token obtained from login')
      .meta({ examples: ['dGhpcyBpcyBhIHJlZnJl...'] }),
  })
  .strict();

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export const logoutSchema = z
  .object({
    refreshToken: z
      .string()
      .min(1)
      .describe('JWT refresh token to revoke')
      .meta({ examples: ['dGhpcyBpcyBhIHJlZnJl...'] }),
  })
  .strict();

export type LogoutInput = z.infer<typeof logoutSchema>;

export const loginStatsSchema = z.object({
  totalSessions: z.number().int().nonnegative(),
  totalProblems: z.number().int().nonnegative(),
  streakDays: z.number().int().nonnegative(),
});

export const loginUserProfileSchema = z.object({
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
  stats: loginStatsSchema,
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

export const loginResponseSchema = z.object({
  accessToken: z
    .string()
    .describe('Short-lived JWT access token')
    .meta({ examples: ['eyJhbGciOiJIUzI1NiIs...'] })
    .optional(),
  user: loginUserProfileSchema.optional(),
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const accessTokenResponseSchema = z.object({
  accessToken: z
    .string()
    .describe('New short-lived JWT access token')
    .meta({ examples: ['eyJhbGciOiJIUzI1NiIs...'] }),
});

export type AccessTokenResponse = z.infer<typeof accessTokenResponseSchema>;
