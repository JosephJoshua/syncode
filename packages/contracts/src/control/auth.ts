import { z } from 'zod';

export const registerSchema = z
  .object({
    username: z
      .string()
      .min(3)
      .max(50)
      .regex(/^[a-zA-Z0-9_]+$/)
      .describe('Username (3-50 chars, letters/numbers/underscore)')
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
