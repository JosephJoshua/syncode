import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CodeQualityPreviewPage } from './code-quality.js';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, number | string>) => {
      if (!values) return key;
      return `${key} ${Object.entries(values)
        .map(([name, value]) => `${name}:${value}`)
        .join(' ')}`;
    },
  }),
}));

describe('CodeQualityPreviewPage', () => {
  it('GIVEN the preview route renders THEN it displays the reusable panel with sample findings', () => {
    render(<CodeQualityPreviewPage />);

    expect(screen.getByRole('heading', { name: 'preview.title' })).toBeInTheDocument();
    expect(screen.getByText('preview.issues.untypedCases')).toBeInTheDocument();
    expect(screen.getByText('scoreSubmission')).toBeInTheDocument();
    expect(
      screen.getByText('duplication.range start:4 end:12 duplicateStart:21 duplicateEnd:27'),
    ).toBeInTheDocument();
  });
});
