import {
  formatSessionDuration,
  normalizeSessionSummary,
  toSessionRow,
} from '@/lib/dashboard-session-history.js';

describe('dashboard session history helpers', () => {
  it('GIVEN broken API duration WHEN normalizing summary THEN uses finishedAt minus createdAt', () => {
    const record = normalizeSessionSummary(
      {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        roomId: '660e8400-e29b-41d4-a716-446655440000',
        mode: 'peer',
        problemTitle: 'Two Sum',
        difficulty: 'easy',
        language: 'python',
        duration: 0,
        participants: [
          {
            userId: '770e8400-e29b-41d4-a716-446655440000',
            username: 'alice',
            displayName: 'Alice',
            avatarUrl: null,
            role: 'candidate',
          },
        ],
        overallScore: 88,
        hasReport: true,
        hasFeedback: false,
        createdAt: '2026-04-20T10:00:00.000Z',
        finishedAt: '2026-04-20T10:05:30.000Z',
      },
      '770e8400-e29b-41d4-a716-446655440000',
    );

    expect(record.durationSeconds).toBe(330);
    expect(toSessionRow(record).durationLabel).toBe('6m');
  });

  it('GIVEN session participants WHEN normalizing summary THEN keeps names for avatar labels', () => {
    const record = normalizeSessionSummary(
      {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        roomId: '660e8400-e29b-41d4-a716-446655440000',
        mode: 'peer',
        problemTitle: 'Two Sum',
        difficulty: 'easy',
        language: 'python',
        duration: 60,
        participants: [
          {
            userId: '770e8400-e29b-41d4-a716-446655440000',
            username: 'alice',
            displayName: 'Alice',
            avatarUrl: null,
            role: 'candidate',
          },
          {
            userId: '880e8400-e29b-41d4-a716-446655440000',
            username: 'bob',
            displayName: null,
            avatarUrl: 'https://cdn.example.com/bob.webp',
            role: 'interviewer',
          },
        ],
        overallScore: 88,
        hasReport: true,
        hasFeedback: false,
        createdAt: '2026-04-20T10:00:00.000Z',
        finishedAt: '2026-04-20T10:01:00.000Z',
      },
      '770e8400-e29b-41d4-a716-446655440000',
    );

    expect(record.partner).toMatchObject({
      name: 'bob',
      initials: 'BO',
      avatarUrl: 'https://cdn.example.com/bob.webp',
    });
  });

  it('GIVEN different duration ranges WHEN formatting THEN returns readable compact labels', () => {
    expect(formatSessionDuration(0)).toBe('0m');
    expect(formatSessionDuration(42)).toBe('42s');
    expect(formatSessionDuration(60)).toBe('1m');
    expect(formatSessionDuration(3660)).toBe('1h 1m');
  });
});
