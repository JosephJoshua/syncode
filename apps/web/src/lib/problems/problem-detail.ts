import { CONTROL_API, type ProblemDetail } from '@syncode/contracts';
import { useQuery } from '@tanstack/react-query';
import { ApiError, api, readApiError } from '@/lib/api-client.js';

export function getProblemDetailQueryKey(problemId: string) {
  return ['problem-detail', problemId] as const;
}

export async function fetchProblemDetail(problemId: string): Promise<ProblemDetail> {
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
