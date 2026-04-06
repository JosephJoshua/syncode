import type { AuthUserResponse } from '@syncode/contracts';
import { SUPPORTED_LANGUAGES } from '@syncode/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatStarterLanguageLabel } from '@/components/problems/starter-code-language';
import {
  canonicalProblemDetailMock,
  resetProblemDetailMockRecords,
  secondaryProblemDetailMock,
} from '@/lib/problems/problem-detail.mock';
import { useAuthStore } from '@/stores/auth.store';
import { ProblemDetailPage } from './problem.$problemId';

const authenticatedUser: AuthUserResponse = {
  id: 'user-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  email: 'dev@syncode.test',
  displayName: 'SynCode Dev',
  role: 'user',
  username: 'syncode-dev',
  avatarUrl: null,
  bio: null,
  stats: {},
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function renderProblemDetailPage(problemId: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ProblemDetailPage problemId={problemId} />
    </QueryClientProvider>,
  );
}

describe('problem detail route page', () => {
  afterEach(() => {
    cleanup();
    resetProblemDetailMockRecords();
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    });
    vi.unstubAllEnvs();
  });

  it('renders the canonical problem detail payload from the query layer', async () => {
    vi.stubEnv('VITE_USE_PROBLEM_DETAIL_MOCK', 'true');

    renderProblemDetailPage(canonicalProblemDetailMock.id);

    expect(
      await screen.findByRole('heading', { name: canonicalProblemDetailMock.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(`problems / ${canonicalProblemDetailMock.title}`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove bookmark' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('Acceptance Rate')).toBeInTheDocument();
    expect(screen.getByText('Total Submissions')).toBeInTheDocument();
    expect(screen.getByText('1,843,201')).toBeInTheDocument();
    expect(screen.getByText('Your Attempts')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Starter Code / Language Templates' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Public Test Cases' })).toBeInTheDocument();
    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.getByText('JavaScript')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('C++')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('Go')).toBeInTheDocument();
    expect(screen.getByText('Rust')).toBeInTheDocument();
    expect(screen.getByText('Basic positive-number case')).toBeInTheDocument();
    expect(screen.queryByText('Negative numbers')).not.toBeInTheDocument();
    expect(document.querySelector('.starter-code-block .token.keyword')).not.toBeNull();
  });

  it('switches starter code language tabs in shared canonical order and preserves syntax highlighting', async () => {
    vi.stubEnv('VITE_USE_PROBLEM_DETAIL_MOCK', 'true');

    const user = userEvent.setup();

    renderProblemDetailPage(canonicalProblemDetailMock.id);

    expect(
      await screen.findByRole('heading', { name: canonicalProblemDetailMock.title }),
    ).toBeInTheDocument();

    const starterLanguageLabels = SUPPORTED_LANGUAGES.map(formatStarterLanguageLabel);
    const visibleStarterLanguageLabels = screen
      .getAllByRole('button')
      .map((button) => button.textContent?.trim() ?? '')
      .filter((label) => starterLanguageLabels.includes(label));

    expect(visibleStarterLanguageLabels).toEqual(starterLanguageLabels);

    await user.click(screen.getByRole('button', { name: 'JavaScript' }));

    expect(screen.getByTestId('starter-code-block')).toHaveTextContent(
      'function twoSum(nums, target)',
    );

    await user.click(screen.getByRole('button', { name: 'Go' }));

    expect(screen.getByTestId('starter-code-block')).toHaveTextContent(
      'func twoSum(nums []int, target int) []int {',
    );
    expect(screen.getByTestId('starter-code-block')).toHaveAttribute('data-language', 'go');

    await user.click(screen.getByRole('button', { name: 'Rust' }));

    expect(screen.getByTestId('starter-code-block')).toHaveTextContent(
      'pub fn two_sum(nums: Vec<i32>, target: i32) -> Vec<i32> {',
    );
    expect(screen.getByTestId('starter-code-block')).toHaveAttribute('data-language', 'rust');
    expect(document.querySelector('.starter-code-block .token.keyword')).not.toBeNull();
  });

  it('uses problem.isBookmarked as the initial state and toggles it in mock mode without signing in', async () => {
    vi.stubEnv('VITE_USE_PROBLEM_DETAIL_MOCK', 'true');

    const user = userEvent.setup();

    renderProblemDetailPage(canonicalProblemDetailMock.id);

    const bookmarkedButton = await screen.findByRole('button', { name: 'Remove bookmark' });
    expect(bookmarkedButton).toHaveAttribute('aria-pressed', 'true');
    expect(bookmarkedButton).toBeEnabled();

    await user.click(bookmarkedButton);

    expect(await screen.findByRole('button', { name: 'Add bookmark' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('renders an outline bookmark when problem.isBookmarked is false', async () => {
    vi.stubEnv('VITE_USE_PROBLEM_DETAIL_MOCK', 'true');

    useAuthStore.setState({
      user: authenticatedUser,
      accessToken: 'token',
      isAuthenticated: true,
    });

    renderProblemDetailPage(secondaryProblemDetailMock.id);

    expect(await screen.findByRole('button', { name: 'Add bookmark' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('handles problems that return only a subset of starter code languages', async () => {
    vi.stubEnv('VITE_USE_PROBLEM_DETAIL_MOCK', 'true');

    renderProblemDetailPage(secondaryProblemDetailMock.id);

    expect(
      await screen.findByRole('heading', { name: secondaryProblemDetailMock.title }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Python' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'JavaScript' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'TypeScript' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Java' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'C++' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'C' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rust' })).not.toBeInTheDocument();
    expect(screen.getByTestId('starter-code-block')).toHaveAttribute('data-language', 'python');
    expect(screen.getByTestId('starter-code-block')).toHaveTextContent(
      'def isValid(self, s: str) -> bool:',
    );
  });

  it('renders a not-found state for unknown problem ids', async () => {
    vi.stubEnv('VITE_USE_PROBLEM_DETAIL_MOCK', 'true');

    renderProblemDetailPage('00000000-0000-0000-0000-000000000000');

    expect(await screen.findByRole('heading', { name: 'Problem not found' })).toBeInTheDocument();
    expect(
      screen.getByText('The requested problem could not be found for this URL.'),
    ).toBeInTheDocument();
  });
});
