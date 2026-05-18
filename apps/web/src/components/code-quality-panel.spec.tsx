import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { type CodeQualityAnalysis, CodeQualityPanel } from './code-quality-panel.js';

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

const analysis: CodeQualityAnalysis = {
  lintIssues: [
    {
      id: 'lint-1',
      severity: 'warning',
      line: 2,
      column: 5,
      rule: 'no-console',
      message: 'Avoid console output.',
    },
  ],
  complexity: [
    {
      id: 'complexity-1',
      functionName: 'solve',
      line: 1,
      cyclomatic: 9,
      cognitive: 13,
    },
  ],
  duplications: [
    {
      id: 'duplication-1',
      startLine: 2,
      endLine: 3,
      duplicateOfStartLine: 5,
      duplicateOfEndLine: 6,
      similarity: 82,
      snippet: 'console.log(input);\nreturn input;',
    },
  ],
};

describe('CodeQualityPanel', () => {
  it('GIVEN quality analysis WHEN rendered THEN shows lint, complexity, duplication, and line metadata', () => {
    render(
      <CodeQualityPanel
        analysis={analysis}
        code={'function solve(input) {\nconsole.log(input);\nreturn input;\n}\nreturn copy;'}
      />,
    );

    expect(screen.getByText('summary.issueCount count:3')).toBeInTheDocument();
    expect(screen.getByText('no-console')).toBeInTheDocument();
    expect(screen.getByText('lineColumn line:2 column:5')).toBeInTheDocument();
    expect(screen.getByText('Avoid console output.')).toBeInTheDocument();
    expect(screen.getByText('solve')).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', {
        name: 'complexity.scoreLabel functionName:solve score:78',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('complexity.cyclomatic value:9')).toBeInTheDocument();
    expect(screen.getByText('complexity.cognitive value:13')).toBeInTheDocument();
    expect(screen.getByText('duplication.similarity value:82')).toBeInTheDocument();
    expect(
      screen.getByText('duplication.range start:2 end:3 duplicateStart:5 duplicateEnd:6'),
    ).toBeInTheDocument();
  });

  it('GIVEN an overlapping lint and duplication line WHEN rendered THEN preserves both visual signals', () => {
    render(
      <CodeQualityPanel
        analysis={analysis}
        code={'function solve(input) {\nconsole.log(input);\nreturn input;\n}'}
      />,
    );

    const lineTwo = screen.getByRole('button', { name: 'editor.selectLine line:2' });

    expect(lineTwo).toHaveClass('bg-warning/10');
    expect(lineTwo).toHaveClass('ring-destructive/30');
  });

  it('GIVEN moderate complexity and no other findings WHEN rendered THEN counts it as a quality issue', () => {
    render(
      <CodeQualityPanel
        analysis={{
          lintIssues: [],
          complexity: [
            {
              id: 'complexity-1',
              functionName: 'parseInput',
              line: 1,
              cyclomatic: 5,
              cognitive: 4,
            },
          ],
          duplications: [],
        }}
        code={'function parseInput(input) {\nreturn input;\n}'}
      />,
    );

    expect(screen.getByText('summary.issueCount count:1')).toBeInTheDocument();
    expect(screen.getByText('complexity.status.moderate')).toBeInTheDocument();
  });

  it('GIVEN a lint issue without a column WHEN rendered THEN shows only the line number', () => {
    render(
      <CodeQualityPanel
        analysis={{
          lintIssues: [
            {
              id: 'lint-1',
              severity: 'error',
              line: 3,
              rule: 'parser/error',
              message: 'Unexpected token.',
            },
          ],
          complexity: [],
          duplications: [],
        }}
        code={'line1\nline2\nline3'}
      />,
    );

    expect(screen.getByText('line line:3')).toBeInTheDocument();
    expect(screen.queryByText(/column:1/)).not.toBeInTheDocument();
  });

  it('GIVEN a line is selected WHEN clicking a finding THEN highlights the line and notifies the parent', async () => {
    const user = userEvent.setup();
    const onSelectLine = vi.fn();

    render(
      <CodeQualityPanel
        analysis={analysis}
        code={'function solve(input) {\nconsole.log(input);\nreturn input;\n}'}
        onSelectLine={onSelectLine}
      />,
    );

    await user.click(screen.getByText('Avoid console output.'));

    const codeViewer = screen.getByRole('heading', { name: 'editor.title' }).closest('section');
    expect(codeViewer).not.toBeNull();
    const selectedLine = within(codeViewer as HTMLElement).getByRole('button', {
      name: 'editor.selectLine line:2',
    });

    expect(selectedLine).toHaveClass('bg-primary/15');
    expect(selectedLine).toHaveAttribute('aria-pressed', 'true');
    expect(onSelectLine).toHaveBeenCalledWith(2);
  });

  it('GIVEN no findings WHEN rendered THEN shows the clean empty states', () => {
    render(
      <CodeQualityPanel
        analysis={{ lintIssues: [], complexity: [], duplications: [] }}
        code={'const ok = true;'}
      />,
    );

    expect(screen.getByText('summary.clean')).toBeInTheDocument();
    expect(screen.getByText('lint.empty')).toBeInTheDocument();
    expect(screen.getByText('complexity.empty')).toBeInTheDocument();
    expect(screen.getByText('duplication.empty')).toBeInTheDocument();
  });
});
