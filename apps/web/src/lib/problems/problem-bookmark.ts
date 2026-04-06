import { CONTROL_API, type ProblemDetail } from '@syncode/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, readApiError } from '@/lib/api-client';
import {
  getProblemDetailQueryKey,
  isProblemDetailMockEnabled,
  normalizeErrorResponse,
  type ProblemDetailErrorResponse,
} from './problem-detail';
import { setMockProblemBookmark } from './problem-detail.mock';

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
  previousProblemDetail: ProblemDetail | undefined;
};

async function setBookmark(problemId: string, bookmarked: boolean) {
  if (isProblemDetailMockEnabled()) {
    setMockProblemBookmark(problemId, bookmarked);
    return;
  }

  const route = bookmarked ? CONTROL_API.BOOKMARKS.ADD : CONTROL_API.BOOKMARKS.REMOVE;

  try {
    await api(route, { params: { problemId } });
  } catch (error) {
    const apiError = normalizeErrorResponse(await readApiError(error));

    if (apiError) {
      throw new ProblemBookmarkApiError(apiError);
    }

    throw error;
  }
}

export async function bookmarkProblem(problemId: string) {
  return setBookmark(problemId, true);
}

export async function removeBookmark(problemId: string) {
  return setBookmark(problemId, false);
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

      const previousProblemDetail = queryClient.getQueryData<ProblemDetail>(queryKey);

      queryClient.setQueryData<ProblemDetail>(queryKey, (currentProblemDetail) => {
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
