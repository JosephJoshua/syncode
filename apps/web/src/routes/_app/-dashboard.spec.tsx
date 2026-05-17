import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authState: {
    isAuthenticated: true,
    user: null as { id: string; username: string } | null,
  },
  fetchDashboardSessionHistory: vi.fn(),
  fetchUserWeaknesses: vi.fn(),
  useUserQuotasQuery: vi.fn(() => ({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(() => Promise.resolve()),
  })),
}));

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn(({ enabled, queryFn }: { enabled?: boolean; queryFn?: () => unknown }) => {
      if (enabled && queryFn) {
        queryFn();
      }

      return {
        data: undefined,
        isLoading: false,
        isError: false,
        refetch: vi.fn(() => Promise.resolve()),
      };
    }),
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options?.name ? `${key}:${String(options.name)}` : key,
  }),
}));

vi.mock('@/stores/auth.store.js', () => ({
  useAuthStore: (selector: (state: typeof mocks.authState) => unknown) => selector(mocks.authState),
}));

vi.mock('@/lib/dashboard-session-history.js', () => ({
  EMPTY_DASHBOARD_STATS: {
    totalSessions: '0',
    passRate: '0%',
    averageScore: '0',
    practiceTime: '0m',
  },
  fetchDashboardSessionHistory: mocks.fetchDashboardSessionHistory,
  getDashboardSessionHistoryQueryKey: (viewerId: string | null) => [
    'dashboard',
    'session-history',
    viewerId,
  ],
}));

vi.mock('@/lib/user-weaknesses.js', () => ({
  USER_WEAKNESSES_QUERY_KEY: ['users', 'me', 'weaknesses'],
  fetchUserWeaknesses: mocks.fetchUserWeaknesses,
}));

vi.mock('@/lib/user-quotas.js', () => ({
  useUserQuotasQuery: mocks.useUserQuotasQuery,
}));

vi.mock('@/components/dashboard-quota-usage.js', () => ({
  DashboardQuotaUsage: () => <div data-testid="quota-panel" />,
}));

vi.mock('@/components/dashboard-weakness-summary.js', () => ({
  DashboardWeaknessSummary: () => <div data-testid="weakness-summary" />,
}));

vi.mock('@/components/dashboard-recent-sessions.js', () => ({
  DashboardRecentSessions: () => <div data-testid="recent-sessions" />,
}));

import { DashboardPage } from './dashboard.js';

describe('DashboardPage', () => {
  beforeEach(() => {
    mocks.authState.isAuthenticated = true;
    mocks.authState.user = null;
    mocks.fetchDashboardSessionHistory.mockReset();
    mocks.fetchUserWeaknesses.mockReset();
    mocks.useUserQuotasQuery.mockClear();
  });

  it('GIVEN authenticated session without loaded profile WHEN rendering THEN still fetches current-user quotas', () => {
    render(<DashboardPage />);

    expect(mocks.useUserQuotasQuery).toHaveBeenCalledWith(true);
    expect(mocks.fetchDashboardSessionHistory).not.toHaveBeenCalled();
    expect(mocks.fetchUserWeaknesses).not.toHaveBeenCalled();
  });
});
