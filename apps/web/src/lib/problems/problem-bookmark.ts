import { defineRoute } from '@syncode/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, readApiError } from '@/lib/api-client';
import { getProblemDetailQueryKey } from './problem-detail';
import {
  type ProblemDetailErrorResponse,
  type ProblemDetailResponse,
  setMockProblemBookmark,
} from './problem-detail.mock';

function getImportMetaEnv() {
  return (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
}

export const bookmarkProblemRoute = defineRoute<void, void>()(
  'users/me/bookmarks/:problemId',
  'PUT',
);
export const removeBookmarkRoute = defineRoute<void, void>()(
  'users/me/bookmarks/:problemId',
  'DELETE',
);

export class ProblemBookmarkApiError extends Error {
  readonly response: ProblemDetailErrorResponse;

  constructor(response: ProblemDetailErrorResponse) {
    super(response.message);
    this.name = 'ProblemBookmarkApiError';
    this.response = response;
    Object.setPrototypeOf(this, ProblemBookmarkApiError.prototype);
  }
}

type ToggleBookmarkVariables = {
  currentIsBookmarked: boolean;
};

type ToggleBookmarkContext = {
  previousProblemDetail: ProblemDetailResponse | undefined;
};

function shouldUseProblemDetailMock() {
  const processEnvValue =
    typeof process !== 'undefined' ? process.env.VITE_USE_PROBLEM_DETAIL_MOCK : undefined;

  return (processEnvValue ?? getImportMetaEnv()?.VITE_USE_PROBLEM_DETAIL_MOCK) === 'true';
}

function normalizeProblemBookmarkErrorResponse(
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

export async function bookmarkProblem(problemId: string) {
  if (shouldUseProblemDetailMock()) {
    setMockProblemBookmark(problemId, true);
    return;
  }

  try {
    await api(bookmarkProblemRoute, {
      params: { problemId },
    });
  } catch (error) {
    const apiError = normalizeProblemBookmarkErrorResponse(await readApiError(error));

    if (apiError) {
      throw new ProblemBookmarkApiError(apiError);
    }

    throw error;
  }
}

export async function removeBookmark(problemId: string) {
  if (shouldUseProblemDetailMock()) {
    setMockProblemBookmark(problemId, false);
    return;
  }

  try {
    await api(removeBookmarkRoute, {
      params: { problemId },
    });
  } catch (error) {
    const apiError = normalizeProblemBookmarkErrorResponse(await readApiError(error));

    if (apiError) {
      throw new ProblemBookmarkApiError(apiError);
    }

    throw error;
  }
}

export function useToggleProblemBookmarkMutation(problemId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, unknown, ToggleBookmarkVariables, ToggleBookmarkContext>({
    mutationFn: async ({ currentIsBookmarked }) => {
      if (currentIsBookmarked) {
        await removeBookmark(problemId);
        return;
      }

      await bookmarkProblem(problemId);
    },
    onMutate: async ({ currentIsBookmarked }) => {
      const queryKey = getProblemDetailQueryKey(problemId);

      await queryClient.cancelQueries({ queryKey });

      const previousProblemDetail = queryClient.getQueryData<ProblemDetailResponse>(queryKey);

      queryClient.setQueryData<ProblemDetailResponse>(queryKey, (currentProblemDetail) => {
        if (!currentProblemDetail) {
          return currentProblemDetail;
        }

        return {
          ...currentProblemDetail,
          isBookmarked: !currentIsBookmarked,
        };
      });

      return {
        previousProblemDetail,
      };
    },
    onError: (error, _variables, context) => {
      if (context?.previousProblemDetail) {
        queryClient.setQueryData(
          getProblemDetailQueryKey(problemId),
          context.previousProblemDetail,
        );
      }

      const message =
        error instanceof ProblemBookmarkApiError
          ? error.response.message
          : 'We could not update this bookmark right now.';

      toast.error(message);
    },
  });
}
