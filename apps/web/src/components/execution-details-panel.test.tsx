import type { ExecutionDetailsResponse } from '@syncode/contracts';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { ExecutionDetailsPanel } from './execution-details-panel';

const mockDetails: ExecutionDetailsResponse = {
  submissionId: '550e8400-e29b-41d4-a716-446655440000',
  status: 'completed',
  totalTestCases: 2,
  passedTestCases: 1,
  failedTestCases: 1,
  errorTestCases: 0,
  totalDurationMs: 83,
  submittedAt: '2026-03-03T12:00:00.000Z',
  completedAt: '2026-03-03T12:00:02.000Z',
  testCases: [
    {
      testCaseIndex: 0,
      passed: true,
      expectedOutput: '2',
      actualOutput: '2',
      stdout: '2\n',
      stderr: '',
      exitCode: 0,
      durationMs: 21,
      memoryUsageMb: 8.4,
      timedOut: false,
      errorMessage: null,
    },
    {
      testCaseIndex: 1,
      passed: false,
      expectedOutput: '42',
      actualOutput: '41',
      stdout: '41\n',
      stderr: 'Assertion failed',
      exitCode: 1,
      durationMs: 62,
      memoryUsageMb: 13.2,
      timedOut: false,
      errorMessage: 'Assertion failed',
    },
  ],
};

describe('ExecutionDetailsPanel', () => {
  test('renders summary and supports expandable test case rows', async () => {
    const user = userEvent.setup();
    render(<ExecutionDetailsPanel details={mockDetails} />);

    expect(screen.getByText('Execution Details')).toBeInTheDocument();
    expect(screen.getByText('Submission 550e8400-e29b-41d4-a716-446655440000')).toBeInTheDocument();
    expect(screen.getByText('Case #1')).toBeInTheDocument();
    expect(screen.getByText('Case #2')).toBeInTheDocument();

    expect(screen.queryByText('Output Diff')).not.toBeInTheDocument();
    expect(screen.queryByText('Execution Log Viewer')).not.toBeInTheDocument();

    const failedCaseButton = screen.getByRole('button', { name: /Case #2/i });
    await user.click(failedCaseButton);

    const failedCaseArticle = failedCaseButton.closest('article');
    expect(failedCaseArticle).not.toBeNull();

    const failedCaseScope = within(failedCaseArticle as HTMLElement);

    expect(failedCaseScope.getByText('Output Diff')).toBeInTheDocument();
    expect(failedCaseScope.getByText('Execution Log Viewer')).toBeInTheDocument();
    expect(failedCaseScope.getByText(/- 42/)).toBeInTheDocument();
    expect(failedCaseScope.getByText(/\+ 41/)).toBeInTheDocument();
    expect(failedCaseScope.getByText('stderr')).toBeInTheDocument();
    expect(failedCaseScope.getByText('Assertion failed')).toBeInTheDocument();
  });

  test('opens one case log viewer at a time', async () => {
    const user = userEvent.setup();
    render(<ExecutionDetailsPanel details={mockDetails} />);

    const caseOneButton = screen.getByRole('button', { name: /Case #1/i });
    const caseTwoButton = screen.getByRole('button', { name: /Case #2/i });

    await user.click(caseOneButton);
    expect(screen.getAllByText('Execution Log Viewer')).toHaveLength(1);

    const caseOneArticle = caseOneButton.closest('article');
    const caseTwoArticle = caseTwoButton.closest('article');
    expect(caseOneArticle).not.toBeNull();
    expect(caseTwoArticle).not.toBeNull();

    const caseOneScope = within(caseOneArticle as HTMLElement);
    const caseTwoScope = within(caseTwoArticle as HTMLElement);

    expect(caseOneScope.getByText('Execution Log Viewer')).toBeInTheDocument();
    expect(caseTwoScope.queryByText('Execution Log Viewer')).not.toBeInTheDocument();

    await user.click(caseTwoButton);
    expect(screen.getAllByText('Execution Log Viewer')).toHaveLength(1);

    expect(caseOneScope.queryByText('Execution Log Viewer')).not.toBeInTheDocument();
    expect(caseTwoScope.getByText('Execution Log Viewer')).toBeInTheDocument();
  });

  test('maps status badge labels correctly for common states', () => {
    const pendingDetails: ExecutionDetailsResponse = {
      ...mockDetails,
      status: 'pending',
    };
    const runningDetails: ExecutionDetailsResponse = {
      ...mockDetails,
      status: 'running',
    };
    const failedDetails: ExecutionDetailsResponse = {
      ...mockDetails,
      status: 'failed',
    };
    const completedAllPassDetails: ExecutionDetailsResponse = {
      ...mockDetails,
      status: 'completed',
      totalTestCases: 2,
      passedTestCases: 2,
      failedTestCases: 0,
      errorTestCases: 0,
      testCases: mockDetails.testCases.map((testCase) => ({
        ...testCase,
        passed: true,
      })),
    };

    const { rerender } = render(<ExecutionDetailsPanel details={pendingDetails} />);
    expect(screen.getByText('pending')).toBeInTheDocument();

    rerender(<ExecutionDetailsPanel details={runningDetails} />);
    expect(screen.getByText('running')).toBeInTheDocument();

    rerender(<ExecutionDetailsPanel details={failedDetails} />);
    expect(screen.getByText('failed')).toBeInTheDocument();

    rerender(<ExecutionDetailsPanel details={completedAllPassDetails} />);
    expect(screen.getByText('completed-all-pass')).toBeInTheDocument();

    rerender(<ExecutionDetailsPanel details={mockDetails} />);
    expect(screen.getByText('completed-partial')).toBeInTheDocument();
  });

  test('closes inline log viewer when clicking the same expanded case again', async () => {
    const user = userEvent.setup();
    render(<ExecutionDetailsPanel details={mockDetails} />);

    const caseTwoButton = screen.getByRole('button', { name: /Case #2/i });

    await user.click(caseTwoButton);
    expect(screen.getAllByText('Execution Log Viewer')).toHaveLength(1);

    await user.click(caseTwoButton);
    expect(screen.queryByText('Execution Log Viewer')).not.toBeInTheDocument();
  });
});
