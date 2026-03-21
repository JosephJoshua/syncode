import { z } from 'zod';
import { userProfileResponseSchema, userStatsSchema } from './users';

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

export const loginStatsSchema = userStatsSchema;

export const loginUserProfileSchema = userProfileResponseSchema;

export const loginResponseSchema = z.object({
  accessToken: z
    .string()
    .describe('Short-lived JWT access token')
    .meta({ examples: ['eyJhbGciOiJIUzI1NiIs...'] })
    .optional(),
  user: loginUserProfileSchema.optional(),
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const registerResponseSchema = loginResponseSchema;

export type RegisterResponse = z.infer<typeof registerResponseSchema>;

export const accessTokenResponseSchema = z.object({
  accessToken: z
    .string()
    .describe('New short-lived JWT access token')
    .meta({ examples: ['eyJhbGciOiJIUzI1NiIs...'] })
    .optional(),
});

export type AccessTokenResponse = z.infer<typeof accessTokenResponseSchema>;
