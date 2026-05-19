import {
  PROBLEM_ATTEMPT_STATUSES,
  PROBLEM_DIFFICULTIES,
  PROBLEMS_SORT_BY_OPTIONS,
  SUPPORTED_LANGUAGES,
} from '@syncode/shared';
import { z } from 'zod';
import { paginationQuerySchema, paginationSchema } from './pagination.js';
import { parseQueryMultiSelect } from './query-parsers.js';

export const PROBLEM_LIST_STATUSES = [...PROBLEM_ATTEMPT_STATUSES, 'todo'] as const;
export type ProblemListStatus = (typeof PROBLEM_LIST_STATUSES)[number];

export const problemsListQuerySchema = paginationQuerySchema.extend({
  difficulty: z
    .preprocess(parseQueryMultiSelect, z.array(z.enum(PROBLEM_DIFFICULTIES)).optional())
    .describe('Filter by difficulties; accepts repeated or comma-separated query params'),
  status: z
    .preprocess(parseQueryMultiSelect, z.array(z.enum(PROBLEM_LIST_STATUSES)).optional())
    .describe('Filter by current user attempt status; accepts repeated or comma-separated values'),
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
  isPublished: z.boolean().describe('Whether this problem is visible to non-admin users'),
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
    .partialRecord(z.enum(SUPPORTED_LANGUAGES), z.string())
    .nullable()
    .describe('Map of SupportedLanguage to starter code string'),
  timeLimit: z.number().nullable().describe('Default execution timeout in milliseconds'),
  memoryLimit: z.number().nullable().describe('Default execution memory limit in MB'),
  totalSubmissions: z.number(),
  userAttempts: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ProblemDetail = z.infer<typeof problemDetailSchema>;

export const createProblemTestCaseSchema = z
  .object({
    input: z.string().trim().min(1).max(20_000),
    expectedOutput: z.string().trim().min(1).max(20_000),
    description: z.string().trim().max(255).optional(),
    isHidden: z.boolean().default(false),
    timeoutMs: z.number().int().positive().max(60_000).optional(),
    memoryMb: z.number().int().positive().max(4096).optional(),
  })
  .strict();

export type CreateProblemTestCase = z.infer<typeof createProblemTestCaseSchema>;

export const createProblemSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(100_000),
    difficulty: z.enum(PROBLEM_DIFFICULTIES),
    isPublished: z.boolean().default(false),
    company: z.string().trim().min(1).max(100).nullable().optional(),
    constraints: z.string().trim().min(1).max(50_000).nullable().optional(),
    examples: z.array(problemExampleSchema).default([]),
    starterCode: z.partialRecord(z.enum(SUPPORTED_LANGUAGES), z.string()).nullable().optional(),
    timeLimit: z.number().int().positive().max(60_000).nullable().optional(),
    memoryLimit: z.number().int().positive().max(4096).nullable().optional(),
    testCases: z.array(createProblemTestCaseSchema).min(1).max(100),
  })
  .strict();

export type CreateProblemInput = z.infer<typeof createProblemSchema>;

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
