import { describe, expect, it, vi } from 'vitest';
import { fetchSessionDetail } from '@/lib/session-detail.js';

const apiMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client.js', () => ({
  api: apiMock,
}));

describe('fetchSessionDetail', () => {
  it('GIVEN session detail response WHEN fetching THEN parses the payload and uses the sessionId path param', async () => {
    apiMock.mockResolvedValueOnce({
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      roomId: '660e8400-e29b-41d4-a716-446655440000',
      mode: 'peer',
      problem: {
        id: '770e8400-e29b-41d4-a716-446655440000',
        title: 'Two Sum',
        difficulty: 'easy',
      },
      language: 'python',
      duration: 2100,
      participants: [
        {
          userId: '880e8400-e29b-41d4-a716-446655440000',
          username: 'alice',
          displayName: 'Alice',
          role: 'candidate',
          joinedAt: '2026-04-20T01:00:00.000Z',
          leftAt: null,
        },
      ],
      runs: [
        {
          jobId: 'job-1',
          status: 'completed',
          createdAt: '2026-04-20T01:10:00.000Z',
        },
      ],
      submissions: [
        {
          submissionId: '990e8400-e29b-41d4-a716-446655440000',
          status: 'completed',
          passed: 4,
          total: 5,
          createdAt: '2026-04-20T01:20:00.000Z',
        },
      ],
      report: null,
      latestCodeSnapshot: null,
      peerFeedback: [],
      hasReport: true,
      hasFeedback: false,
      hasRecording: true,
      createdAt: '2026-04-20T01:00:00.000Z',
      finishedAt: '2026-04-20T01:35:00.000Z',
    });

    await expect(fetchSessionDetail('550e8400-e29b-41d4-a716-446655440000')).resolves.toEqual(
      expect.objectContaining({
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        language: 'python',
        duration: 2100,
      }),
    );

    expect(apiMock).toHaveBeenCalledWith(expect.anything(), {
      params: { id: '550e8400-e29b-41d4-a716-446655440000' },
    });
  });
});
