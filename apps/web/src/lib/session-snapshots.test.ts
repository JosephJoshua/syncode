import { fetchSessionSnapshots } from '@/lib/session-snapshots.js';

const { mockApi } = vi.hoisted(() => ({
  mockApi: vi.fn(),
}));

vi.mock('@/lib/api-client.js', () => ({
  api: mockApi,
}));

describe('fetchSessionSnapshots', () => {
  beforeEach(() => {
    mockApi.mockReset();
  });

  it('GIVEN snapshot response WHEN fetching THEN returns parsed snapshot list', async () => {
    mockApi.mockResolvedValue({
      data: [
        {
          snapshotId: '550e8400-e29b-41d4-a716-446655440000',
          timestamp: '2026-04-20T14:00:00.000Z',
          trigger: 'phase_change',
          language: 'typescript',
          code: 'const answer = 42;',
          linesOfCode: 1,
        },
      ],
    });

    await expect(fetchSessionSnapshots('660e8400-e29b-41d4-a716-446655440000')).resolves.toEqual([
      expect.objectContaining({
        trigger: 'phase_change',
        code: 'const answer = 42;',
      }),
    ]);
  });
});
