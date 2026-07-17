import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SessionRow } from '@/lib/dashboard-session-history.js';
import { DashboardRecentSessions } from './dashboard-recent-sessions.js';

vi.mock('@tanstack/react-router', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router');
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'actions.deleteSessionAriaLabelWithProblem') {
        return `Delete session for ${String(options?.problem)} on ${String(options?.date)}`;
      }

      return key;
    },
  }),
}));

vi.mock('@/lib/i18n.js', () => ({
  default: {
    language: 'en',
    t: (key: string) => key,
  },
}));

vi.mock('@/stores/auth.store.js', () => ({
  useAuthStore: (
    selector: (state: { user: { displayName: string; username: string } }) => unknown,
  ) => selector({ user: { displayName: 'Ada Lovelace', username: 'ada' } }),
}));

function makeRow(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    date: '2026-01-02T03:04:00.000Z',
    problemName: 'Two Sum',
    partner: null,
    observer: null,
    role: 'candidate',
    status: 'passed',
    score: 90,
    durationSeconds: 300,
    durationLabel: '5m',
    ...overrides,
  };
}

function renderRecentSessions(rows: SessionRow[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardRecentSessions viewerId="user-1" rows={rows} />
    </QueryClientProvider>,
  );
}

describe('DashboardRecentSessions', () => {
  it('GIVEN session rows WHEN rendering delete actions THEN each button names the target session', () => {
    renderRecentSessions([makeRow()]);

    expect(
      screen.getByRole('button', { name: /Delete session for Two Sum on/ }),
    ).toBeInTheDocument();
  });
});
