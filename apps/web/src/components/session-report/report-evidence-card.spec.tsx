import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('@monaco-editor/react', () => ({
  default: ({ value }: { value: string }) => <pre data-testid="monaco-editor">{value}</pre>,
}));

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

  it('GIVEN a code_snippet evidence item with language WHEN rendered THEN shows Monaco editor', () => {
    render(
      <ul>
        <EvidenceCard
          item={{ type: 'code_snippet', reference: 'return [0, 1]', description: 'Final return.' }}
          language="typescript"
        />
      </ul>,
    );

    expect(screen.getByText('Final return.')).toBeInTheDocument();
    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
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

  it('GIVEN an unknown evidence type WHEN rendered THEN shows raw reference as fallback', () => {
    render(
      <ul>
        <EvidenceCard
          item={{ type: 'unknown_type', reference: 'some-ref', description: 'Some description.' }}
        />
      </ul>,
    );

    expect(screen.getByText('Some description.')).toBeInTheDocument();
    expect(screen.getByText('some-ref')).toBeInTheDocument();
  });
});
