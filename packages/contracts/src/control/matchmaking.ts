import { JOINABLE_ROLES, PROBLEM_DIFFICULTIES, SUPPORTED_LANGUAGES } from '@syncode/shared';
import { z } from 'zod';

export const matchmakingPreferencesSchema = z
  .object({
    languages: z
      .array(z.enum(SUPPORTED_LANGUAGES))
      .max(SUPPORTED_LANGUAGES.length)
      .optional()
      .default([])
      .describe('Preferred languages. Empty means any language.'),
    difficulties: z
      .array(z.enum(PROBLEM_DIFFICULTIES))
      .max(PROBLEM_DIFFICULTIES.length)
      .optional()
      .default([])
      .describe('Preferred difficulties. Empty means any difficulty.'),
    problemIds: z
      .array(z.uuid())
      .max(20)
      .optional()
      .default([])
      .describe('Preferred problem IDs. Empty means any published problem.'),
    topics: z
      .array(z.string().trim().min(1))
      .max(20)
      .optional()
      .default([])
      .describe('Preferred problem topics (tag slugs). Empty means any topic.'),
    roles: z
      .array(z.enum(JOINABLE_ROLES))
      .max(JOINABLE_ROLES.length)
      .optional()
      .default([])
      .describe('Preferred room roles. Empty means any role.'),
  })
  .strict();

export type MatchmakingPreferences = z.infer<typeof matchmakingPreferencesSchema>;

export const enterMatchmakingQueueSchema = matchmakingPreferencesSchema;
export type EnterMatchmakingQueueInput = z.infer<typeof enterMatchmakingQueueSchema>;

const matchmakingSearchingStatusSchema = z.object({
  status: z.literal('searching'),
  requestId: z.uuid(),
  queuePosition: z.int().positive(),
  expiresAt: z.iso.datetime(),
  preferences: matchmakingPreferencesSchema,
});

const matchmakingMatchedStatusSchema = z.object({
  status: z.literal('matched'),
  requestId: z.uuid(),
  roomId: z.uuid(),
  matchedWithUserId: z.uuid(),
  expiresAt: z.iso.datetime(),
  preferences: matchmakingPreferencesSchema,
});

export const enterMatchmakingQueueResponseSchema = z.union([
  matchmakingSearchingStatusSchema,
  matchmakingMatchedStatusSchema,
]);

export type EnterMatchmakingQueueResponse = z.infer<typeof enterMatchmakingQueueResponseSchema>;

export const leaveMatchmakingQueueResponseSchema = z.object({
  status: z.literal('idle'),
});

export type LeaveMatchmakingQueueResponse = z.infer<typeof leaveMatchmakingQueueResponseSchema>;

export const getMatchmakingStatusResponseSchema = z.union([
  z.object({
    status: z.literal('idle'),
  }),
  matchmakingSearchingStatusSchema,
  matchmakingMatchedStatusSchema,
]);

export type GetMatchmakingStatusResponse = z.infer<typeof getMatchmakingStatusResponseSchema>;
