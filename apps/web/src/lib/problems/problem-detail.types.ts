import type { SupportedLanguage } from '@syncode/shared';

export interface ProblemDetailPathParams {
  id: string;
}

export interface ProblemExample {
  input: string;
  output: string;
  explanation?: string;
}

export interface ProblemTestCase {
  input: string;
  expectedOutput: string;
  description?: string;
  isHidden: boolean;
  timeoutMs?: number;
  memoryMb?: number;
}

export interface ProblemDetailResponse {
  id: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  company: string | null;
  acceptanceRate: number | null;
  isBookmarked: boolean;
  attemptStatus: 'solved' | 'attempted' | null;
  testCaseCount?: number;
  hiddenTestCaseCount?: number;
  totalSubmissions: number;
  updatedAt: string;
  description: string;
  constraints: string | null;
  examples: ProblemExample[];
  testCases: ProblemTestCase[];
  starterCode: Partial<Record<SupportedLanguage, string>> | null;
  userAttempts: number;
  createdAt: string;
}

export interface ProblemDetailErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}
