import { ERROR_CODES } from '@syncode/contracts';
import { fetchSessionReport } from '@/lib/session-report.js';

const { mockApi, mockReadApiError } = vi.hoisted(() => ({
  mockApi: vi.fn(),
  mockReadApiError: vi.fn(),
}));

vi.mock('@/lib/api-client.js', () => ({
  api: mockApi,
  readApiError: mockReadApiError,
}));

describe('fetchSessionReport', () => {
  beforeEach(() => {
    mockApi.mockReset();
    mockReadApiError.mockReset();
  });

  it('GIVEN a completed report response WHEN fetching THEN returns a ready result', async () => {
    mockApi.mockResolvedValue({
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      generatedAt: '2026-04-20T14:00:00.000Z',
      overallScore: 87,
      strengths: ['Clear reasoning'],
      areasForImprovement: ['Tighten edge-case handling'],
      detailedFeedback: 'Solid work.',
      comparisonToHistory: null,
      peerFeedbackSummary: null,
      testCaseBreakdown: [],
    });

    await expect(fetchSessionReport('550e8400-e29b-41d4-a716-446655440000')).resolves.toEqual({
      state: 'ready',
      report: expect.objectContaining({
        overallScore: 87,
        strengths: ['Clear reasoning'],
      }),
    });
  });

  it('GIVEN not-ready 404 response WHEN fetching THEN returns a pending result', async () => {
    const error = new Error('not ready');
    mockApi.mockRejectedValue(error);
    mockReadApiError.mockResolvedValue({
      statusCode: 404,
      code: ERROR_CODES.SESSION_REPORT_NOT_READY,
      message: 'Session report not yet generated',
      timestamp: '2026-04-20T14:00:00.000Z',
      details: null,
    });

    await expect(fetchSessionReport('550e8400-e29b-41d4-a716-446655440000')).resolves.toEqual({
      state: 'pending',
    });
  });

  it('GIVEN unavailable 404 response WHEN fetching THEN returns an unavailable result', async () => {
    const error = new Error('candidate-only report');
    mockApi.mockRejectedValue(error);
    mockReadApiError.mockResolvedValue({
      statusCode: 404,
      code: ERROR_CODES.SESSION_REPORT_UNAVAILABLE,
      message: 'Session report is only generated for the candidate',
      timestamp: '2026-04-20T14:00:00.000Z',
      details: null,
    });

    await expect(fetchSessionReport('550e8400-e29b-41d4-a716-446655440000')).resolves.toEqual({
      state: 'unavailable',
    });
  });
});
