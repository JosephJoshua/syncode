import { CONTROL_API, type ProblemDetail } from '@syncode/contracts';
import { useQuery } from '@tanstack/react-query';
import { api, readApiError } from '@/lib/api-client';
import { createProblemDetailNotFoundError, getMockProblemDetail } from './problem-detail.mock';

export interface ProblemDetailErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

function getImportMetaEnv() {
  return (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
}

export class ProblemDetailApiError extends Error {
  readonly response: ProblemDetailErrorResponse;

  constructor(response: ProblemDetailErrorResponse) {
    super(response.message);
    this.name = 'ProblemDetailApiError';
    this.response = response;
    Object.setPrototypeOf(this, ProblemDetailApiError.prototype);
  }
}

function shouldUseProblemDetailMock() {
  const processEnvValue =
    typeof process !== 'undefined' ? process.env.VITE_USE_PROBLEM_DETAIL_MOCK : undefined;

  return (processEnvValue ?? getImportMetaEnv()?.VITE_USE_PROBLEM_DETAIL_MOCK) === 'true';
}

export function isProblemDetailMockEnabled() {
  return shouldUseProblemDetailMock();
}

export function getProblemDetailQueryKey(problemId: string) {
  return ['problem-detail', problemId] as const;
}

export function normalizeErrorResponse(
  error: {
    statusCode: number;
    code?: string;
    message: string;
    timestamp: string;
    details?: Record<string, unknown>;
  } | null,
): ProblemDetailErrorResponse | null {
  if (!error) {
    return null;
  }

  return {
    statusCode: error.statusCode,
    code: error.code ?? 'UNKNOWN_ERROR',
    message: error.message,
    timestamp: error.timestamp,
    details: error.details,
  };
}

export async function fetchProblemDetail(problemId: string): Promise<ProblemDetail> {
  if (shouldUseProblemDetailMock()) {
    const mockProblemDetail = getMockProblemDetail(problemId);

    if (!mockProblemDetail) {
      throw new ProblemDetailApiError(createProblemDetailNotFoundError(problemId));
    }

    return mockProblemDetail;
  }

  try {
    return await api(CONTROL_API.PROBLEMS.GET_BY_ID, {
      params: { id: problemId },
    });
  } catch (error) {
    const apiError = normalizeErrorResponse(await readApiError(error));

    if (apiError) {
      throw new ProblemDetailApiError(apiError);
    }

    throw error;
  }
}

export function problemDetailQueryOptions(problemId: string) {
  return {
    queryKey: getProblemDetailQueryKey(problemId),
    queryFn: () => fetchProblemDetail(problemId),
    enabled: Boolean(problemId),
  };
}

export function useProblemDetailQuery(problemId: string) {
  return useQuery(problemDetailQueryOptions(problemId));
}
