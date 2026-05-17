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

  it('GIVEN interviewer session with overall score WHEN normalizing summary THEN score and status remain visible', () => {
    const record = normalizeSessionSummary(
      {
        sessionId: '11111111-1111-4111-8111-111111111111',
        roomId: '22222222-2222-4222-8222-222222222222',
        mode: 'peer',
        problemTitle: 'Two Sum',
        difficulty: 'easy',
        language: 'python',
        duration: 120,
        participants: [
          {
            userId: 'viewer-id',
            username: 'viewer',
            displayName: 'Viewer',
            avatarUrl: null,
            role: 'interviewer',
          },
          {
            userId: 'candidate-id',
            username: 'candidate',
            displayName: 'Candidate',
            avatarUrl: null,
            role: 'candidate',
          },
        ],
        overallScore: 72,
        hasReport: true,
        hasFeedback: false,
        createdAt: '2026-04-20T10:00:00.000Z',
        finishedAt: '2026-04-20T10:02:00.000Z',
      },
      'viewer-id',
    );

    const row = toSessionRow(record);

    expect(record.role).toBe('interviewer');
    expect(record.score).toBe(72);
    expect(record.status).toBe('passed');
    expect(row.score).toBe(72);
    expect(row.status).toBe('passed');
  });

  it('GIVEN observer session with overall score WHEN normalizing summary THEN score and status stay hidden', () => {
    const record = normalizeSessionSummary(
      {
        sessionId: '11111111-1111-4111-8111-111111111111',
        roomId: '22222222-2222-4222-8222-222222222222',
        mode: 'peer',
        problemTitle: 'Two Sum',
        difficulty: 'easy',
        language: 'python',
        duration: 120,
        participants: [
          {
            userId: 'observer-id',
            username: 'observer',
            displayName: 'Observer',
            avatarUrl: null,
            role: 'observer',
          },
          {
            userId: 'candidate-id',
            username: 'candidate',
            displayName: 'Candidate',
            avatarUrl: null,
            role: 'candidate',
          },
        ],
        overallScore: 72,
        hasReport: true,
        hasFeedback: false,
        createdAt: '2026-04-20T10:00:00.000Z',
        finishedAt: '2026-04-20T10:02:00.000Z',
      },
      'observer-id',
    );

    const row = toSessionRow(record);

    expect(record.role).toBe('observer');
    expect(record.score).toBeNull();
    expect(record.status).toBeNull();
    expect(row.score).toBeNull();
    expect(row.status).toBeNull();
  });

  it('GIVEN different duration ranges WHEN formatting THEN returns readable compact labels', () => {
    expect(formatSessionDuration(0)).toBe('0m');
    expect(formatSessionDuration(42)).toBe('42s');
    expect(formatSessionDuration(60)).toBe('1m');
    expect(formatSessionDuration(3660)).toBe('1h 1m');
  });
});
