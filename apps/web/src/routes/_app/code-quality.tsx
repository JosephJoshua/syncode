import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { type CodeQualityAnalysis, CodeQualityPanel } from '@/components/code-quality-panel.js';

export const Route = createFileRoute('/_app/code-quality')({
  component: CodeQualityPreviewPage,
});

const previewCode = `function scoreSubmission(cases) {
  let score = 0;

  for (const testCase of cases) {
    if (testCase.passed) {
      score += testCase.weight;
    } else if (testCase.timedOut) {
      score -= 1;
    } else if (testCase.stderr) {
      score -= 2;
    }
  }

  return score;
}

function buildSummary(cases) {
  let passed = 0;
  let failed = 0;

  for (const testCase of cases) {
    if (testCase.passed) {
      passed += 1;
    } else {
      failed += 1;
    }
  }

  return { passed, failed };
}`;

export function CodeQualityPreviewPage() {
  const { t } = useTranslation('codeQuality');
  const analysis: CodeQualityAnalysis = {
    lintIssues: [
      {
        id: 'lint-1',
        severity: 'warning',
        line: 1,
        column: 26,
        rule: 'typescript/no-explicit-any',
        message: t('preview.issues.untypedCases'),
      },
      {
        id: 'lint-2',
        severity: 'info',
        line: 8,
        column: 7,
        rule: 'complexity/no-nested-branches',
        message: t('preview.issues.branching'),
      },
    ],
    complexity: [
      {
        id: 'complexity-1',
        functionName: 'scoreSubmission',
        line: 1,
        cyclomatic: 9,
        cognitive: 13,
      },
      {
        id: 'complexity-2',
        functionName: 'buildSummary',
        line: 17,
        cyclomatic: 4,
        cognitive: 5,
      },
    ],
    duplications: [
      {
        id: 'duplication-1',
        startLine: 4,
        endLine: 12,
        duplicateOfStartLine: 21,
        duplicateOfEndLine: 27,
        similarity: 82,
        snippet: previewCode.split('\n').slice(3, 12).join('\n'),
      },
    ],
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:py-12">
      <section className="mb-8 max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t('preview.title')}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">
          {t('preview.description')}
        </p>
      </section>
      <CodeQualityPanel analysis={analysis} code={previewCode} />
    </div>
  );
}
