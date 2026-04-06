import { SUPPORTED_LANGUAGES } from '@syncode/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, readApiError } from '@/lib/api-client';
import { fetchProblemDetail, ProblemDetailApiError, problemDetailRoute } from './problem-detail';
import {
  canonicalProblemDetailMock,
  type ProblemDetailResponse,
  resetProblemDetailMockRecords,
} from './problem-detail.mock';

vi.mock('@/lib/api-client', () => ({
  api: vi.fn(),
  readApiError: vi.fn(),
}));

describe('problem detail data layer', () => {
  afterEach(() => {
    resetProblemDetailMockRecords();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('returns the canonical mock response with every required top-level key', async () => {
    vi.stubEnv('VITE_USE_PROBLEM_DETAIL_MOCK', 'true');

    const response = await fetchProblemDetail(canonicalProblemDetailMock.id);

    expect(response).toEqual(canonicalProblemDetailMock);
    expect(Object.keys(response)).toEqual(
      expect.arrayContaining([
        'id',
        'title',
        'difficulty',
        'tags',
        'company',
        'acceptanceRate',
        'isBookmarked',
        'attemptStatus',
        'testCaseCount',
        'hiddenTestCaseCount',
        'totalSubmissions',
        'updatedAt',
        'description',
        'constraints',
        'examples',
        'testCases',
        'starterCode',
        'userAttempts',
        'createdAt',
      ]),
    );
    expect(response.testCaseCount).toBeTypeOf('number');
    expect(response.hiddenTestCaseCount).toBeTypeOf('number');
    expect(response.examples[0]).toMatchObject({
      input: expect.any(String),
      output: expect.any(String),
    });
    expect(response.testCases[0]).toMatchObject({
      input: expect.any(String),
      expectedOutput: expect.any(String),
      isHidden: expect.any(Boolean),
    });
    expect(response.starterCode).not.toBeNull();
    expect(Object.keys(response.starterCode ?? {})).toEqual(SUPPORTED_LANGUAGES);
  });

  it('throws an API-shaped not found error in mock mode', async () => {
    vi.stubEnv('VITE_USE_PROBLEM_DETAIL_MOCK', 'true');

    await expect(fetchProblemDetail('00000000-0000-0000-0000-000000000000')).rejects.toMatchObject({
      name: 'ProblemDetailApiError',
      response: {
        statusCode: 404,
        code: 'PROBLEM_NOT_FOUND',
        message: 'Problem not found',
        details: {
          problemId: '00000000-0000-0000-0000-000000000000',
        },
      },
    });
  });

  it('calls the unified api client with path params when mock mode is disabled', async () => {
    vi.stubEnv('VITE_USE_PROBLEM_DETAIL_MOCK', 'false');

    const expectedResponse: ProblemDetailResponse = canonicalProblemDetailMock;

    vi.mocked(api).mockResolvedValueOnce(expectedResponse);

    const response = await fetchProblemDetail(expectedResponse.id);

    expect(api).toHaveBeenCalledWith(problemDetailRoute, {
      params: { id: expectedResponse.id },
    });
    expect(response).toEqual(expectedResponse);
  });

  it('wraps parsed API errors into ProblemDetailApiError for the page layer', async () => {
    vi.stubEnv('VITE_USE_PROBLEM_DETAIL_MOCK', 'false');

    vi.mocked(api).mockRejectedValueOnce(new Error('HTTP error'));
    vi.mocked(readApiError).mockResolvedValueOnce({
      statusCode: 404,
      code: 'ROOM_NOT_FOUND',
      message: 'Problem not found',
      timestamp: '2026-04-06T00:00:00.000Z',
      details: { id: 'missing' },
    });

    await expect(fetchProblemDetail('missing')).rejects.toBeInstanceOf(ProblemDetailApiError);
  });
});
