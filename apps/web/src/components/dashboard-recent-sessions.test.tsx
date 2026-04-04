import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { DashboardRecentSessions } from '@/components/dashboard-recent-sessions';
import { buildDashboardSessionHistory } from '@/lib/dashboard-session-history';
import {
  MOCK_SESSION_HISTORY_RESPONSE,
  MOCK_SESSION_HISTORY_VIEWER_ID,
} from '@/lib/session-history.mock';
import { useAuthStore } from '@/stores/auth.store';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params: _params,
    to: _to,
    ...props
  }: {
    children: ReactNode;
    params?: unknown;
    to?: string;
    [key: string]: unknown;
  }) => (
    <a href={typeof _to === 'string' ? _to : '#'} {...props}>
      {children}
    </a>
  ),
}));

describe('DashboardRecentSessions', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: 'user-current',
        email: 'mia@example.com',
        displayName: 'Mia Evans',
        createdAt: '2024-01-01T00:00:00.000Z',
        role: 'user',
        username: 'mia',
        avatarUrl: null,
        bio: null,
        stats: {},
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      isAuthenticated: true,
    });
  });

  test('renders loading state', () => {
    render(<DashboardRecentSessions rows={[]} isLoading />);

    expect(screen.getByText('Loading sessions')).toBeInTheDocument();
  });

  test('renders error state with retry action', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(<DashboardRecentSessions rows={[]} isError onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test('renders empty state when there is no history', () => {
    render(<DashboardRecentSessions rows={[]} />);

    expect(screen.getByText('No sessions yet')).toBeInTheDocument();
  });

  test('renders unavailable state when query is disabled', () => {
    render(<DashboardRecentSessions rows={[]} isUnavailable />);

    expect(screen.getByText('Session history unavailable')).toBeInTheDocument();
  });

  test('renders no-match state after searching', async () => {
    const user = userEvent.setup();
    const rows = buildDashboardSessionHistory(
      MOCK_SESSION_HISTORY_RESPONSE,
      MOCK_SESSION_HISTORY_VIEWER_ID,
    ).rows;

    render(<DashboardRecentSessions rows={rows} />);

    await user.type(screen.getByPlaceholderText('Search by problem name'), 'graph');

    expect(await screen.findByText('No matching sessions')).toBeInTheDocument();
  });

  test('filters rows with the shadcn select', async () => {
    const user = userEvent.setup();
    const rows = buildDashboardSessionHistory(
      MOCK_SESSION_HISTORY_RESPONSE,
      MOCK_SESSION_HISTORY_VIEWER_ID,
    ).rows;

    render(<DashboardRecentSessions rows={rows} />);

    await user.click(screen.getByRole('combobox', { name: 'Filter sessions' }));
    await user.click(await screen.findByRole('option', { name: 'Passed only' }));

    expect(screen.getByText('Two Sum')).toBeInTheDocument();
    expect(screen.getByText('Valid Parentheses')).toBeInTheDocument();
    expect(
      screen.queryByText('Longest Substring Without Repeating Characters'),
    ).not.toBeInTheDocument();
  });

  test('sorts rows with the shadcn select', async () => {
    const user = userEvent.setup();
    const rows = buildDashboardSessionHistory(
      MOCK_SESSION_HISTORY_RESPONSE,
      MOCK_SESSION_HISTORY_VIEWER_ID,
    ).rows;

    render(<DashboardRecentSessions rows={rows} />);

    await user.click(screen.getByRole('combobox', { name: 'Sort sessions' }));
    await user.click(await screen.findByRole('option', { name: 'Score: Low to high' }));

    const problemLinks = screen.getAllByRole('link');

    expect(problemLinks[0]).toHaveTextContent('Binary Tree Level Order Traversal');
    expect(problemLinks[1]).toHaveTextContent('Trapping Rain Water');
    expect(problemLinks[2]).toHaveTextContent('LRU Cache');
    expect(problemLinks[3]).toHaveTextContent('Longest Substring Without Repeating Characters');
    expect(problemLinks[4]).toHaveTextContent('Valid Parentheses');
    expect(problemLinks[5]).toHaveTextContent('Two Sum');
  });
});
