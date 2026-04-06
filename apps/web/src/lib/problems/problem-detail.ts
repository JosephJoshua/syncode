import { defineRoute } from '@syncode/contracts';
import { useQuery } from '@tanstack/react-query';
import { api, readApiError } from '@/lib/api-client';
import {
  createProblemDetailNotFoundError,
  getMockProblemDetail,
  type ProblemDetailErrorResponse,
  type ProblemDetailResponse,
} from './problem-detail.mock';

export const problemDetailRoute = defineRoute<void, ProblemDetailResponse>()('problems/:id', 'GET');

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
  return import.meta.env.VITE_USE_PROBLEM_DETAIL_MOCK === 'true';
}

function normalizeProblemDetailErrorResponse(
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

export async function fetchProblemDetail(problemId: string): Promise<ProblemDetailResponse> {
  if (shouldUseProblemDetailMock()) {
    const mockProblemDetail = getMockProblemDetail(problemId);

    if (!mockProblemDetail) {
      throw new ProblemDetailApiError(createProblemDetailNotFoundError(problemId));
    }

    return mockProblemDetail;
  }

  try {
    return await api(problemDetailRoute, {
      params: { id: problemId },
    });
  } catch (error) {
    const apiError = normalizeProblemDetailErrorResponse(await readApiError(error));

    if (apiError) {
      throw new ProblemDetailApiError(apiError);
    }

    throw error;
  }
}

export function problemDetailQueryOptions(problemId: string) {
  return {
    queryKey: ['problem-detail', problemId] as const,
    queryFn: () => fetchProblemDetail(problemId),
    enabled: Boolean(problemId),
  };
}

export function useProblemDetailQuery(problemId: string) {
  return useQuery(problemDetailQueryOptions(problemId));
}
