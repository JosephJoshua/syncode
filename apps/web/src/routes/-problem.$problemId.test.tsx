import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canonicalProblemDetailMock } from '@/lib/problems/problem-detail.mock';
import { ProblemDetailPage } from './problem.$problemId';

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
    vi.unstubAllEnvs();
  });

  it('renders the canonical problem detail payload from the query layer', async () => {
    vi.stubEnv('VITE_USE_PROBLEM_DETAIL_MOCK', 'true');

    renderProblemDetailPage(canonicalProblemDetailMock.id);

    expect(
      await screen.findByRole('heading', { name: canonicalProblemDetailMock.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(`problems / ${canonicalProblemDetailMock.title}`)).toBeInTheDocument();
    expect(screen.getByText('Bookmarked')).toBeInTheDocument();
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
    expect(screen.getByText('Basic positive-number case')).toBeInTheDocument();
    expect(screen.queryByText('Negative numbers')).not.toBeInTheDocument();
    expect(document.querySelector('.starter-code-block .token.keyword')).not.toBeNull();
  });

  it('switches starter code language tabs without changing the data source', async () => {
    vi.stubEnv('VITE_USE_PROBLEM_DETAIL_MOCK', 'true');

    const user = userEvent.setup();

    renderProblemDetailPage(canonicalProblemDetailMock.id);

    expect(
      await screen.findByRole('heading', { name: canonicalProblemDetailMock.title }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'JavaScript' }));

    expect(screen.getByTestId('starter-code-block')).toHaveTextContent(
      'function twoSum(nums, target)',
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
