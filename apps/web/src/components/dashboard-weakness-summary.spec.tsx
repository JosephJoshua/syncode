import type { UserWeakness } from '@syncode/contracts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardWeaknessSummary } from './dashboard-weakness-summary.js';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params,
    to,
  }: {
    children: React.ReactNode;
    params?: { sessionId: string };
    to: string;
  }) => <a href={to.replace('$sessionId', params?.sessionId ?? '')}>{children}</a>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (options?.problem !== undefined)
        return `${key}:${String(options.problem)}:${String(options.score)}`;
      if (options?.category !== undefined) {
        return `${key}:${String(options.category)}:${String(options.count)}`;
      }
      if (options?.score !== undefined) return `${key}:${String(options.score)}`;
      if (options?.count !== undefined) return `${key}:${String(options.count)}`;
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

function makeWeakness(overrides: Partial<UserWeakness> = {}): UserWeakness {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    category: 'time_complexity',
    description: 'Complexity analysis needs work',
    frequency: 5,
    trend: 'worsening',
    lastSeenAt: '2026-01-03T00:00:00.000Z',
    sessions: [
      {
        sessionId: '22222222-2222-4222-8222-222222222222',
        problemName: 'Two Sum',
        reportedAt: '2026-01-03T00:00:00.000Z',
        score: 68,
      },
    ],
    ...overrides,
  };
}

describe('DashboardWeaknessSummary', () => {
  it('GIVEN persisted weaknesses WHEN rendering THEN shows real categories, trend, frequency, and session links', () => {
    render(
      <DashboardWeaknessSummary
        weaknesses={[
          makeWeakness(),
          makeWeakness({
            id: '33333333-3333-4333-8333-333333333333',
            category: 'edge_cases',
            description: 'Missed empty input',
            frequency: 1,
            trend: 'improving',
            lastSeenAt: '2026-01-02T00:00:00.000Z',
            sessions: [],
          }),
        ]}
      />,
    );

    expect(screen.getByText('weakness.category.time_complexity.title')).toBeInTheDocument();
    expect(screen.getByText('Complexity analysis needs work')).toBeInTheDocument();
    expect(screen.getAllByText('weakness.trend.worsening')).not.toHaveLength(0);
    expect(screen.getByText('weakness.frequency:5')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Two Sum/ })).toHaveAttribute(
      'href',
      '/sessions/22222222-2222-4222-8222-222222222222',
    );
    expect(
      screen.getByRole('progressbar', {
        name: 'weakness.trendPoint:Two Sum:68',
      }),
    ).toBeInTheDocument();
  });

  it('GIVEN a load error WHEN rendering THEN shows error state instead of empty data copy', () => {
    render(<DashboardWeaknessSummary weaknesses={[]} isError />);

    expect(screen.getAllByText('weakness.errorTitle')).not.toHaveLength(0);
    expect(screen.queryByText('weakness.noDataTitle')).not.toBeInTheDocument();
    expect(screen.queryByText('weakness.noTrendTitle')).not.toBeInTheDocument();
  });
});
