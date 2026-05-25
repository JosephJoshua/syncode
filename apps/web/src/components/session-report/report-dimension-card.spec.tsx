import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ReportDimensionCard } from './report-dimension-card.js';

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('ReportDimensionCard', () => {
  it('GIVEN long dimension feedback WHEN rendering THEN feedback is collapsed by default and can expand', async () => {
    const feedback = Array.from({ length: 80 }, (_, index) => `detail-${index + 1}`).join(' ');
    render(
      <ReportDimensionCard
        title="Correctness"
        dimension={{
          score: 82,
          feedback,
          evidence: [],
        }}
      />,
    );

    const feedbackText = screen.getByTestId('dimension-feedback-text');
    expect(feedbackText.className).toContain('max-h-[7.5rem]');
    expect(screen.getByRole('button', { name: 'actions.showFullReview' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'actions.showFullReview' }));

    expect(screen.getByRole('button', { name: 'actions.showLessReview' })).toBeInTheDocument();
    expect(feedbackText.className).not.toContain('max-h-[7.5rem]');
  });

  it('GIVEN short dimension feedback WHEN rendering THEN expand control is hidden', () => {
    render(
      <ReportDimensionCard
        title="Correctness"
        dimension={{
          score: 82,
          feedback: 'Short summary.',
          evidence: [],
        }}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'actions.showFullReview' }),
    ).not.toBeInTheDocument();
  });
});
