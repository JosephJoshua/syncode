import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StaticAnalysisPanel, type StaticAnalysisPanelState } from './static-analysis-panel.js';

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

describe('StaticAnalysisPanel', () => {
  it('GIVEN pending static analysis WHEN rendered THEN shows the analyzer status', () => {
    render(<StaticAnalysisPanel analysis={{ status: 'pending' }} />);

    expect(screen.getByText('workspace.staticAnalysisTitle')).toBeInTheDocument();
    expect(screen.getByText('workspace.staticAnalysisPending')).toBeInTheDocument();
  });

  it('GIVEN completed analysis with mixed evidence WHEN rendered THEN summarizes the findings', () => {
    const analysis: StaticAnalysisPanelState = {
      status: 'completed',
      jobId: 'static-job-1',
      source: 'run',
      runId: '11111111-1111-1111-1111-111111111111',
      submissionId: null,
      language: 'python',
      createdAt: '2026-05-19T01:00:00.000Z',
      completedAt: '2026-05-19T01:00:01.000Z',
      summary: {
        diagnosticCount: 1,
        errorCount: 0,
        warningCount: 1,
        maxCyclomaticComplexity: 14,
        highComplexityCount: 1,
        duplicationCount: 1,
        toolFailureCount: 1,
      },
      diagnostics: [
        {
          tool: 'ruff',
          rule: 'N802',
          severity: 'warning',
          message: 'Function name should be lowercase',
          file: 'solution.py',
          line: 3,
          column: 5,
        },
      ],
      complexity: [
        {
          tool: 'lizard',
          functionName: 'solve',
          file: 'solution.py',
          startLine: 1,
          endLine: 20,
          cyclomaticComplexity: 14,
        },
      ],
      duplications: [
        {
          tool: 'cpd',
          lines: 8,
          tokens: 64,
          occurrences: [
            {
              file: 'solution.py',
              startLine: 12,
              endLine: 20,
            },
          ],
        },
      ],
      toolResults: [
        {
          tool: 'ruff',
          status: 'completed',
          exitCode: 0,
          durationMs: 12,
          timedOut: false,
        },
        {
          tool: 'cpd',
          status: 'failed',
          exitCode: null,
          durationMs: 15000,
          timedOut: true,
          error: 'Timed out',
        },
      ],
      error: null,
    };

    render(<StaticAnalysisPanel analysis={analysis} />);

    expect(screen.getByText('workspace.staticAnalysisCompleted')).toBeInTheDocument();
    expect(screen.getByText('Function name should be lowercase')).toBeInTheDocument();
    expect(
      screen.getByText('workspace.staticAnalysisComplexityFinding name:solve value:14'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('workspace.staticAnalysisDuplicationFinding lines:8'),
    ).toBeInTheDocument();
    expect(screen.getByText('workspace.staticAnalysisToolFailed tool:cpd')).toBeInTheDocument();
  });

  it('GIVEN completed analysis without findings WHEN rendered THEN shows the clean state', () => {
    render(
      <StaticAnalysisPanel
        analysis={{
          status: 'completed',
          jobId: 'static-job-1',
          source: 'submission',
          runId: null,
          submissionId: '22222222-2222-2222-2222-222222222222',
          language: 'typescript',
          createdAt: '2026-05-19T01:00:00.000Z',
          completedAt: '2026-05-19T01:00:01.000Z',
          summary: {
            diagnosticCount: 0,
            errorCount: 0,
            warningCount: 0,
            maxCyclomaticComplexity: null,
            highComplexityCount: 0,
            duplicationCount: 0,
            toolFailureCount: 0,
          },
          diagnostics: [],
          complexity: [],
          duplications: [],
          toolResults: [],
          error: null,
        }}
      />,
    );

    expect(screen.getByText('workspace.staticAnalysisClean')).toBeInTheDocument();
    expect(screen.getByText('workspace.staticAnalysisSubmission')).toBeInTheDocument();
  });
});
