import { CONTROL_API } from '@syncode/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, readApiError } from '@/lib/api-client';
import {
  bookmarkProblem,
  removeBookmark,
  useToggleProblemBookmarkMutation,
} from './problem-bookmark';
import { getProblemDetailQueryKey } from './problem-detail';
import {
  canonicalProblemDetailMock,
  getMockProblemDetail,
  resetProblemDetailMockRecords,
  secondaryProblemDetailMock,
} from './problem-detail.mock';

vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  api: vi.fn(),
  readApiError: vi.fn(),
}));

const { toastError } = vi.hoisted(() => ({
  toastError: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: toastError,
  },
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('problem bookmark data layer', () => {
  afterEach(() => {
    resetProblemDetailMockRecords();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('updates the mock problem detail bookmark to true in mock mode', async () => {
    vi.stubEnv('VITE_USE_PROBLEM_DETAIL_MOCK', 'true');

    await removeBookmark(canonicalProblemDetailMock.id);
    expect(getMockProblemDetail(canonicalProblemDetailMock.id)?.isBookmarked).toBe(false);

    await bookmarkProblem(canonicalProblemDetailMock.id);
    expect(getMockProblemDetail(canonicalProblemDetailMock.id)?.isBookmarked).toBe(true);
  });

  it('updates the mock problem detail bookmark to false in mock mode', async () => {
    vi.stubEnv('VITE_USE_PROBLEM_DETAIL_MOCK', 'true');

    await removeBookmark(canonicalProblemDetailMock.id);

    expect(getMockProblemDetail(canonicalProblemDetailMock.id)?.isBookmarked).toBe(false);
  });

  it('calls the unified api client without a request body when bookmarking in real mode', async () => {
    vi.stubEnv('VITE_USE_PROBLEM_DETAIL_MOCK', 'false');

    vi.mocked(api).mockResolvedValueOnce(undefined);

    await bookmarkProblem(canonicalProblemDetailMock.id);

    expect(api).toHaveBeenCalledWith(CONTROL_API.BOOKMARKS.ADD, {
      params: { problemId: canonicalProblemDetailMock.id },
    });
  });

  it('calls the unified api client without a request body when removing a bookmark in real mode', async () => {
    vi.stubEnv('VITE_USE_PROBLEM_DETAIL_MOCK', 'false');

    vi.mocked(api).mockResolvedValueOnce(undefined);

    await removeBookmark(canonicalProblemDetailMock.id);

    expect(api).toHaveBeenCalledWith(CONTROL_API.BOOKMARKS.REMOVE, {
      params: { problemId: canonicalProblemDetailMock.id },
    });
  });

  it('wraps parsed API errors into ApiError', async () => {
    vi.stubEnv('VITE_USE_PROBLEM_DETAIL_MOCK', 'false');

    vi.mocked(api).mockRejectedValueOnce(new Error('HTTP error'));
    vi.mocked(readApiError).mockResolvedValueOnce({
      statusCode: 404,
      code: 'ROOM_NOT_FOUND',
      message: 'Problem not found',
      timestamp: '2026-04-06T00:00:00.000Z',
      details: { problemId: 'missing' },
    });

    await expect(removeBookmark('missing')).rejects.toBeInstanceOf(ApiError);
  });

  it('patches the current problem detail query cache on successful toggle in real mode', async () => {
    vi.stubEnv('VITE_USE_PROBLEM_DETAIL_MOCK', 'false');

    const queryClient = createQueryClient();
    const problemDetail = {
      ...secondaryProblemDetailMock,
      isBookmarked: false,
    };

    queryClient.setQueryData(getProblemDetailQueryKey(problemDetail.id), problemDetail);
    vi.mocked(api).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useToggleProblemBookmarkMutation(problemDetail.id), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({
      currentIsBookmarked: problemDetail.isBookmarked,
    });

    expect(
      queryClient.getQueryData<typeof problemDetail>(getProblemDetailQueryKey(problemDetail.id)),
    ).toMatchObject({
      isBookmarked: true,
    });
  });

  it('rolls back the current problem detail query cache when the toggle mutation fails', async () => {
    vi.stubEnv('VITE_USE_PROBLEM_DETAIL_MOCK', 'false');

    const queryClient = createQueryClient();
    const problemDetail = {
      ...secondaryProblemDetailMock,
      isBookmarked: false,
    };
    const mutationError = new Error('HTTP error');
    let rejectRequest: ((reason?: unknown) => void) | null = null;

    queryClient.setQueryData(getProblemDetailQueryKey(problemDetail.id), problemDetail);
    vi.mocked(api).mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectRequest = reject;
        }),
    );
    vi.mocked(readApiError).mockResolvedValueOnce({
      statusCode: 404,
      code: 'ROOM_NOT_FOUND',
      message: 'Problem not found',
      timestamp: '2026-04-06T00:00:00.000Z',
      details: { problemId: problemDetail.id },
    });

    const { result } = renderHook(() => useToggleProblemBookmarkMutation(problemDetail.id), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({
      currentIsBookmarked: problemDetail.isBookmarked,
    });

    await waitFor(() =>
      expect(
        queryClient.getQueryData<typeof problemDetail>(getProblemDetailQueryKey(problemDetail.id)),
      ).toMatchObject({
        isBookmarked: true,
      }),
    );

    await waitFor(() => expect(rejectRequest).not.toBeNull());

    const settleRequest = rejectRequest as ((reason?: unknown) => void) | null;

    if (!settleRequest) {
      throw new Error('Expected the bookmark request to be pending before rollback.');
    }

    settleRequest(mutationError);

    await waitFor(() =>
      expect(
        queryClient.getQueryData<typeof problemDetail>(getProblemDetailQueryKey(problemDetail.id)),
      ).toMatchObject({
        isBookmarked: false,
      }),
    );
    expect(toastError).toHaveBeenCalledWith('Problem not found');
  });
});
