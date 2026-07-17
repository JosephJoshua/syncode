import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) =>
      (
        ({
          'evidence.type.code_line': 'Code line',
          'evidence.type.code_snippet': 'Code snippet',
          'evidence.type.event_timestamp': 'Session event',
          'evidence.type.unknown': 'Evidence',
          'evidence.referenceUnavailable': 'Reference unavailable',
        }) as Record<string, string>
      )[key] ??
      opts?.defaultValue ??
      key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('@monaco-editor/react', () => ({
  default: ({ value }: { value: string }) => <pre data-testid="monaco-editor">{value}</pre>,
}));

vi.mock('@/lib/monaco-loader.js', () => ({}));

vi.mock('@/components/room-workspace-utils.js', () => ({
  EDITOR_LOADING: null,
  EDITOR_OPTIONS_BASE: {},
  handleEditorWillMount: vi.fn(),
  toMonacoLanguage: (lang: string) => lang,
}));

import { EvidenceCard } from './report-evidence-card.js';

describe('EvidenceCard', () => {
  it('GIVEN a code_line evidence item WHEN rendered THEN shows description and reference', () => {
    render(
      <ul>
        <EvidenceCard
          item={{
            type: 'code_line',
            reference: 'L3: return [0, 1]',
            description: 'Returns early.',
          }}
        />
      </ul>,
    );

    expect(screen.getByText('Returns early.')).toBeInTheDocument();
    expect(screen.getByText('L3: return [0, 1]')).toBeInTheDocument();
  });

  it('GIVEN a code_snippet evidence item with language WHEN rendered THEN shows Monaco editor', async () => {
    render(
      <ul>
        <EvidenceCard
          item={{ type: 'code_snippet', reference: 'return [0, 1]', description: 'Final return.' }}
          language="typescript"
        />
      </ul>,
    );

    expect(screen.getByText('Final return.')).toBeInTheDocument();
    expect(await screen.findByTestId('monaco-editor')).toBeInTheDocument();
  });

  it('GIVEN an event_timestamp evidence item WHEN rendered THEN shows formatted time', () => {
    render(
      <ul>
        <EvidenceCard
          item={{
            type: 'event_timestamp',
            reference: '2026-04-20T01:01:00.000Z',
            description: 'Transitioned to wrapup.',
          }}
        />
      </ul>,
    );

    expect(screen.getByText('Transitioned to wrapup.')).toBeInTheDocument();
  });

  it('GIVEN an invalid event_timestamp reference WHEN rendered THEN shows the raw reference', () => {
    render(
      <ul>
        <EvidenceCard
          item={{
            type: 'event_timestamp',
            reference: 'not-a-date',
            description: 'Malformed timestamp.',
          }}
        />
      </ul>,
    );

    expect(screen.getByText('not-a-date')).toBeInTheDocument();
    expect(screen.queryByText('Invalid Date')).not.toBeInTheDocument();
  });

  it('GIVEN an empty code_line reference WHEN rendered THEN shows unavailable fallback', () => {
    render(
      <ul>
        <EvidenceCard
          item={{ type: 'code_line', reference: '   ', description: 'Missing reference.' }}
        />
      </ul>,
    );

    expect(screen.getByText('Reference unavailable')).toBeInTheDocument();
  });

  it('GIVEN a long code_line reference WHEN rendered THEN allows wrapping inside the card', () => {
    const longReference = `L1: ${'x'.repeat(160)}`;

    render(
      <ul>
        <EvidenceCard
          item={{
            type: 'code_line',
            reference: longReference,
            description: 'Long line.',
          }}
        />
      </ul>,
    );

    const reference = screen.getByText(longReference);
    expect(reference).toHaveClass('whitespace-pre-wrap');
    expect(reference).toHaveClass('break-words');
  });

  it('GIVEN an unknown evidence type WHEN rendered THEN shows raw reference as fallback', () => {
    render(
      <ul>
        <EvidenceCard
          item={{ type: 'unknown_type', reference: 'some-ref', description: 'Some description.' }}
        />
      </ul>,
    );

    expect(screen.getByText('Some description.')).toBeInTheDocument();
    expect(screen.getByText('Evidence')).toBeInTheDocument();
    expect(screen.getByText('some-ref')).toBeInTheDocument();
    expect(screen.queryByText('unknown_type')).not.toBeInTheDocument();
  });
});
