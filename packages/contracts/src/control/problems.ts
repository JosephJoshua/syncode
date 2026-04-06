import {
  PROBLEM_ATTEMPT_STATUSES,
  PROBLEM_DIFFICULTIES,
  PROBLEMS_SORT_BY_OPTIONS,
} from '@syncode/shared';
import { z } from 'zod';
import { paginationQuerySchema, paginationSchema } from './pagination.js';

export const problemsListQuerySchema = paginationQuerySchema.extend({
  difficulty: z.enum(PROBLEM_DIFFICULTIES).optional().describe('Filter by difficulty'),
  tags: z.string().optional().describe('Comma-separated tag slugs'),
  company: z.string().optional().describe('Company slug filter'),
  search: z.string().optional().describe('Full-text search on title + description'),
  sortBy: z.enum(PROBLEMS_SORT_BY_OPTIONS).optional().describe('Sort field'),
});

export type ProblemsListQuery = z.infer<typeof problemsListQuerySchema>;

export const problemSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  difficulty: z.enum(PROBLEM_DIFFICULTIES),
  tags: z.array(z.string()),
  company: z.string().nullable(),
  acceptanceRate: z
    .number()
    .nullable()
    .describe('Acceptance rate percentage; null if no submissions'),
  isBookmarked: z.boolean().describe('Whether the current user has bookmarked this problem'),
  attemptStatus: z
    .enum(PROBLEM_ATTEMPT_STATUSES)
    .nullable()
    .describe("Current user's attempt history"),
  testCaseCount: z.number().optional().describe('Admin-only'),
  hiddenTestCaseCount: z.number().optional().describe('Admin-only'),
  totalSubmissions: z.number().optional().describe('Admin-only'),
  updatedAt: z.string().optional().describe('Admin-only'),
});

export type ProblemSummary = z.infer<typeof problemSummarySchema>;

export const problemsListResponseSchema = z.object({
  data: z.array(problemSummarySchema),
  pagination: paginationSchema,
});

export type ProblemsListResponse = z.infer<typeof problemsListResponseSchema>;

export const problemExampleSchema = z.object({
  input: z.string(),
  output: z.string(),
  explanation: z.string().optional(),
});

export type ProblemExample = z.infer<typeof problemExampleSchema>;

export const problemTestCaseSchema = z.object({
  input: z.string(),
  expectedOutput: z.string(),
  description: z.string().optional(),
  isHidden: z.boolean(),
  timeoutMs: z.number().optional(),
  memoryMb: z.number().optional(),
});

export type ProblemTestCase = z.infer<typeof problemTestCaseSchema>;

export const problemDetailSchema = problemSummarySchema.extend({
  description: z.string().describe('Problem description in markdown'),
  constraints: z.string().nullable().describe('Problem constraints in markdown'),
  examples: z.array(problemExampleSchema),
  testCases: z.array(problemTestCaseSchema).describe('Only visible (non-hidden) test cases'),
  starterCode: z
    .record(z.string(), z.string())
    .nullable()
    .describe('Map of SupportedLanguage to starter code string'),
  totalSubmissions: z.number(),
  userAttempts: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ProblemDetail = z.infer<typeof problemDetailSchema>;

export const tagInfoSchema = z.object({
  slug: z.string(),
  name: z.string(),
  count: z.number().describe('Number of problems with this tag'),
});

export type TagInfo = z.infer<typeof tagInfoSchema>;

export const problemsTagsResponseSchema = z.object({
  data: z.array(tagInfoSchema),
});

export type ProblemsTagsResponse = z.infer<typeof problemsTagsResponseSchema>;
