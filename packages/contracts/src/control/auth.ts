import { UserRole } from '@syncode/shared';
import { z } from 'zod';

export const registerSchema = z
  .object({
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

export const loginSchema = z
  .object({
    identifier: z
      .string()
      .min(1)
      .describe('Email address or username')
      .meta({ examples: ['user@example.com', 'code_partner'] }),
    password: z
      .string()
      .min(1)
      .describe('Password')
      .meta({ examples: ['P@ssw0rd!'] }),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;

export const authUserResponseSchema = z.object({
  id: z
    .string()
    .describe('User ID')
    .meta({ examples: ['usr_123'] }),
  email: z
    .email()
    .describe('Email address')
    .meta({ examples: ['user@example.com'] }),
  username: z
    .string()
    .describe('Unique username')
    .meta({ examples: ['code_partner'] }),
  displayName: z.string().nullable(),
  role: z.enum([UserRole.USER, UserRole.ADMIN]),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable(),
  stats: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type AuthUserResponse = z.infer<typeof authUserResponseSchema>;

export const loginResponseSchema = z.object({
  accessToken: z
    .string()
    .describe('Short-lived JWT access token')
    .meta({ examples: ['eyJhbGciOiJIUzI1NiIs...'] })
    .optional(),
  user: authUserResponseSchema.optional(),
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;

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

export const authTokensResponseSchema = z.object({
  accessToken: z
    .string()
    .describe('Short-lived JWT access token')
    .meta({ examples: ['eyJhbGciOiJIUzI1NiIs...'] }),
  refreshToken: z
    .string()
    .describe('Long-lived JWT refresh token')
    .meta({ examples: ['dGhpcyBpcyBhIHJlZnJl...'] }),
});

export type AuthTokensResponse = z.infer<typeof authTokensResponseSchema>;

export const accessTokenResponseSchema = z.object({
  accessToken: z
    .string()
    .describe('New short-lived JWT access token')
    .meta({ examples: ['eyJhbGciOiJIUzI1NiIs...'] }),
});

export type AccessTokenResponse = z.infer<typeof accessTokenResponseSchema>;
