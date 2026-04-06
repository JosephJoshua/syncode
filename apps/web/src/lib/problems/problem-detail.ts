import { CONTROL_API, type ProblemDetail } from '@syncode/contracts';
import { useQuery } from '@tanstack/react-query';
import { ApiError, api, readApiError } from '@/lib/api-client';
import { createProblemDetailNotFoundError, getMockProblemDetail } from './problem-detail.mock';

export function isProblemDetailMockEnabled() {
  return import.meta.env.VITE_USE_PROBLEM_DETAIL_MOCK === 'true';
}

export function getProblemDetailQueryKey(problemId: string) {
  return ['problem-detail', problemId] as const;
}

export async function fetchProblemDetail(problemId: string): Promise<ProblemDetail> {
  if (isProblemDetailMockEnabled()) {
    const mockProblemDetail = getMockProblemDetail(problemId);

    if (!mockProblemDetail) {
      throw new ApiError(createProblemDetailNotFoundError(problemId));
    }

    return mockProblemDetail;
  }

  try {
    return await api(CONTROL_API.PROBLEMS.GET_BY_ID, {
      params: { id: problemId },
    });
  } catch (error) {
    const apiError = await readApiError(error);

    if (apiError) {
      throw new ApiError(apiError);
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
