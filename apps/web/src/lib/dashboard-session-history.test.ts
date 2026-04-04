import { describe, expect, test } from 'vitest';
import {
  buildDashboardSessionHistory,
  buildDashboardStats,
  loadDashboardSessionHistory,
  normalizeSessionSummary,
  parseSessionHistoryResponse,
  type SessionSummary,
} from '@/lib/dashboard-session-history';
import {
  MOCK_SESSION_HISTORY_RESPONSE,
  MOCK_SESSION_HISTORY_VIEWER_ID,
} from '@/lib/session-history.mock';

describe('dashboard session history', () => {
  test('maps mock API data into dashboard rows and stats through one shared pipeline', () => {
    const response = parseSessionHistoryResponse(MOCK_SESSION_HISTORY_RESPONSE);
    const result = buildDashboardSessionHistory(response, MOCK_SESSION_HISTORY_VIEWER_ID);

    expect(result.rows).toHaveLength(6);
    expect(result.rows.map((row) => row.role)).toEqual([
      'candidate',
      'candidate',
      'interviewer',
      'observer',
      'candidate',
      'interviewer',
    ]);
    expect(result.rows[1]).toMatchObject({
      id: 'session-2',
      problemName: 'Longest Substring Without Repeating Characters',
      role: 'candidate',
      status: 'failed',
      score: 58,
      durationMinutes: 38,
    });
    expect(result.rows[3]).toMatchObject({
      id: 'session-4',
      role: 'observer',
      partner: null,
    });
    expect(result.stats).toEqual({
      totalSessions: '6',
      passRate: '67%',
      averageScore: '84%',
      practiceTime: '4h',
    });
  });

  test('treats unsupported roles conservatively and excludes them from candidate stats', () => {
    const baseSession = MOCK_SESSION_HISTORY_RESPONSE.data[0];

    expect(baseSession).toBeDefined();

    if (!baseSession) {
      throw new Error('Expected a base mock session for the unsupported role test.');
    }

    const unsupportedRoleSession: SessionSummary = {
      ...baseSession,
      sessionId: 'session-host',
      participants: [
        {
          userId: 'user-current',
          role: 'host',
          displayName: 'Mia Evans',
          username: 'mia',
          avatarUrl: null,
        },
      ],
      overallScore: 100,
    };

    const record = normalizeSessionSummary(unsupportedRoleSession, 'user-current');
    const stats = buildDashboardStats([record]);

    expect(record.viewerRole).toBeNull();
    expect(record.role).toBe('observer');
    expect(record.status).toBeNull();
    expect(stats.passRate).toBe('--');
    expect(stats.averageScore).toBe('--');
  });

  test('loads dashboard history from mock source without hitting the API pipeline', async () => {
    const result = await loadDashboardSessionHistory({
      source: 'mock',
      currentUserId: null,
    });

    expect(result.rows).toHaveLength(MOCK_SESSION_HISTORY_RESPONSE.data.length);
    expect(result.rows[0]).toMatchObject({
      id: 'session-1',
      role: 'candidate',
      durationMinutes: 45,
    });
    expect(result.stats).toEqual({
      totalSessions: '6',
      passRate: '67%',
      averageScore: '84%',
      practiceTime: '4h',
    });
  });
});
