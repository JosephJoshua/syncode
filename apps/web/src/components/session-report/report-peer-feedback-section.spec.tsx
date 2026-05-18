import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReportPeerFeedbackSection } from './report-peer-feedback-section.js';

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string | number>) =>
      values?.name ? `${key} ${values.name}` : key,
  }),
}));

describe('ReportPeerFeedbackSection', () => {
  it('GIVEN peer feedback with reviewer and candidate avatars THEN renders both avatar images', () => {
    const { container } = render(
      <ReportPeerFeedbackSection
        feedback={{
          allSubmitted: true,
          data: [
            {
              id: '550e8400-e29b-41d4-a716-446655440001',
              sessionId: '550e8400-e29b-41d4-a716-446655440002',
              roomId: '550e8400-e29b-41d4-a716-446655440003',
              reviewerId: '550e8400-e29b-41d4-a716-446655440004',
              reviewerName: 'Alice',
              reviewerAvatarUrl: 'https://cdn.example.com/alice.webp',
              candidateId: '550e8400-e29b-41d4-a716-446655440005',
              candidateName: 'Bob',
              candidateAvatarUrl: 'https://cdn.example.com/bob.webp',
              problemSolvingRating: 4,
              communicationRating: 4,
              codeQualityRating: 5,
              debuggingRating: 3,
              overallRating: 4,
              strengths: 'Clear explanation',
              improvements: 'More edge cases',
              wouldPairAgain: true,
              createdAt: '2026-04-01T00:58:00.000Z',
            },
          ],
        }}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Alice')).toBeInTheDocument();
    expect(screen.getByLabelText('Bob')).toBeInTheDocument();
    const imageSources = Array.from(container.querySelectorAll('img')).map((img) =>
      img.getAttribute('src'),
    );
    expect(imageSources).toContain('https://cdn.example.com/alice.webp');
    expect(imageSources).toContain('https://cdn.example.com/bob.webp');
  });
});
