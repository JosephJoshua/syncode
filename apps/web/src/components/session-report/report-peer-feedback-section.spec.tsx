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
  const entry = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    sessionId: '550e8400-e29b-41d4-a716-446655440002',
    roomId: '550e8400-e29b-41d4-a716-446655440003',
    reviewerId: '550e8400-e29b-41d4-a716-446655440004',
    reviewerName: 'Alice',
    reviewerAvatarUrl: 'https://cdn.example.com/alice.webp',
    candidateId: '550e8400-e29b-41d4-a716-446655440005',
    candidateName: 'Bob',
    candidateAvatarUrl: 'https://cdn.example.com/bob.webp',
    status: 'submitted' as const,
    feedbackText: 'Clear explanation\n\nMore edge cases',
    createdAt: '2026-04-01T00:58:00.000Z',
  };

  it('GIVEN peer feedback with reviewer and candidate avatars THEN renders both avatar images', () => {
    const { container } = render(
      <ReportPeerFeedbackSection
        feedback={{
          allSubmitted: true,
          data: [entry],
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

  it('GIVEN current user has visible feedback while peers are pending THEN still renders feedback', () => {
    render(
      <ReportPeerFeedbackSection
        feedback={{
          allSubmitted: false,
          data: [entry],
        }}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText('Alice → Bob')).toBeInTheDocument();
    expect(screen.getByText(/Clear explanation/)).toBeInTheDocument();
    expect(screen.getByText(/More edge cases/)).toBeInTheDocument();
    expect(screen.getByText('peerFeedbackSection.awaitingResponses')).toBeInTheDocument();
    expect(screen.queryByText('peerFeedbackSection.hiddenUntilSubmitted')).not.toBeInTheDocument();
  });
});
