import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  Progress,
} from '@syncode/ui';
import { AlertTriangle, CheckCircle2, Copy, Gauge, ListChecks } from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export type CodeQualitySeverity = 'error' | 'warning' | 'info';

export interface CodeQualityLintIssue {
  readonly id: string;
  readonly severity: CodeQualitySeverity;
  readonly line: number;
  readonly column?: number;
  readonly rule: string;
  readonly message: string;
}

export interface CodeQualityComplexityMetric {
  readonly id: string;
  readonly functionName: string;
  readonly line: number;
  readonly cyclomatic: number;
  readonly cognitive: number;
}

export interface CodeQualityDuplication {
  readonly id: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly duplicateOfStartLine: number;
  readonly duplicateOfEndLine: number;
  readonly similarity: number;
  readonly snippet: string;
}

export interface CodeQualityAnalysis {
  readonly lintIssues: CodeQualityLintIssue[];
  readonly complexity: CodeQualityComplexityMetric[];
  readonly duplications: CodeQualityDuplication[];
}

interface CodeQualityPanelProps {
  readonly analysis: CodeQualityAnalysis;
  readonly code: string;
  readonly className?: string;
  readonly onSelectLine?: (line: number) => void;
}

export function CodeQualityPanel({
  analysis,
  code,
  className,
  onSelectLine,
}: CodeQualityPanelProps) {
  const { t } = useTranslation('codeQuality');
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const codeLines = useMemo(() => code.replace(/\r\n/g, '\n').split('\n'), [code]);
  const summary = useMemo(() => summarizeAnalysis(analysis), [analysis]);

  const selectLine = (line: number) => {
    setSelectedLine(line);
    onSelectLine?.(line);
  };

  return (
    <Card className={cn('border border-border/50 bg-card/80 py-0 backdrop-blur-sm', className)}>
      <CardHeader className="border-b border-border/40 px-5 pt-6 pb-5 sm:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="size-5 text-primary" />
              {t('panel.title')}
            </CardTitle>
            <CardDescription>{t('panel.description')}</CardDescription>
          </div>
          <Badge variant={summary.issueCount === 0 ? 'success' : 'warning'} className="w-fit">
            {summary.issueCount === 0
              ? t('summary.clean')
              : t('summary.issueCount', { count: summary.issueCount })}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5 px-5 pt-5 pb-6 sm:px-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryTile
              icon={<AlertTriangle className="size-4" />}
              label={t('summary.lint')}
              value={analysis.lintIssues.length}
              tone={analysis.lintIssues.length > 0 ? 'warning' : 'success'}
            />
            <SummaryTile
              icon={<Gauge className="size-4" />}
              label={t('summary.complexity')}
              value={summary.highComplexityCount}
              tone={summary.highComplexityCount > 0 ? 'warning' : 'success'}
            />
            <SummaryTile
              icon={<Copy className="size-4" />}
              label={t('summary.duplication')}
              value={analysis.duplications.length}
              tone={analysis.duplications.length > 0 ? 'warning' : 'success'}
            />
          </div>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">{t('lint.title')}</h2>
            {analysis.lintIssues.length > 0 ? (
              <div className="space-y-2">
                {analysis.lintIssues.map((issue) => (
                  <button
                    key={issue.id}
                    type="button"
                    className="w-full rounded-lg border border-border/60 bg-background/50 p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                    onClick={() => selectLine(issue.line)}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge size="sm" variant={severityVariant[issue.severity]}>
                        {t(`severity.${issue.severity}`)}
                      </Badge>
                      <span className="font-mono text-xs text-muted-foreground">
                        {t('lineColumn', { line: issue.line, column: issue.column ?? 1 })}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">{issue.rule}</span>
                    </div>
                    <p className="mt-2 text-sm text-foreground">{issue.message}</p>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState label={t('lint.empty')} />
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">{t('complexity.title')}</h2>
            {analysis.complexity.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {analysis.complexity.map((metric) => {
                  const score = getComplexityScore(metric);
                  return (
                    <button
                      key={metric.id}
                      type="button"
                      className="rounded-lg border border-border/60 bg-background/50 p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                      onClick={() => selectLine(metric.line)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-sm text-foreground">
                            {metric.functionName}
                          </p>
                          <p className="mt-1 font-mono text-xs text-muted-foreground">
                            {t('line', { line: metric.line })}
                          </p>
                        </div>
                        <Badge size="sm" variant={getComplexityVariant(score)}>
                          {t(`complexity.status.${getComplexityStatus(score)}`)}
                        </Badge>
                      </div>
                      <Progress className="mt-3 h-2" value={Math.min(score, 100)} />
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <span>{t('complexity.cyclomatic', { value: metric.cyclomatic })}</span>
                        <span>{t('complexity.cognitive', { value: metric.cognitive })}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyState label={t('complexity.empty')} />
            )}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-lg border border-border/60 bg-background/50">
            <div className="border-b border-border/50 px-3 py-2">
              <h2 className="text-sm font-semibold text-foreground">{t('editor.title')}</h2>
            </div>
            <div className="max-h-[520px] overflow-auto p-2">
              {codeLines.map((line, index) => {
                const lineNumber = index + 1;
                const highlight = getLineHighlight(lineNumber, analysis, selectedLine);
                return (
                  <button
                    key={`${lineNumber}-${line}`}
                    type="button"
                    className={cn(
                      'grid w-full grid-cols-[3rem_minmax(0,1fr)] rounded px-2 py-0.5 text-left font-mono text-xs leading-6',
                      highlight,
                    )}
                    aria-label={t('editor.selectLine', { line: lineNumber })}
                    onClick={() => selectLine(lineNumber)}
                  >
                    <span className="select-none text-right text-muted-foreground/60">
                      {lineNumber}
                    </span>
                    <code className="min-w-0 overflow-x-auto whitespace-pre pl-3 text-foreground/90">
                      {line || ' '}
                    </code>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">{t('duplication.title')}</h2>
            {analysis.duplications.length > 0 ? (
              <div className="space-y-3">
                {analysis.duplications.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="w-full rounded-lg border border-border/60 bg-background/50 p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                    onClick={() => selectLine(item.startLine)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge size="sm" variant="warning">
                        {t('duplication.similarity', { value: Math.round(item.similarity) })}
                      </Badge>
                      <span className="font-mono text-xs text-muted-foreground">
                        {t('duplication.range', {
                          start: item.startLine,
                          end: item.endLine,
                          duplicateStart: item.duplicateOfStartLine,
                          duplicateEnd: item.duplicateOfEndLine,
                        })}
                      </span>
                    </div>
                    <pre className="mt-3 max-h-28 overflow-auto rounded border border-border bg-card p-2 font-mono text-xs text-foreground/80">
                      {item.snippet}
                    </pre>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState label={t('duplication.empty')} />
            )}
          </section>
        </aside>
      </CardContent>
    </Card>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  tone,
}: {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly value: number;
  readonly tone: 'success' | 'warning';
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/50 p-4">
      <div
        className={cn(
          'mb-3 inline-flex size-9 items-center justify-center rounded-lg border',
          tone === 'success'
            ? 'border-success/30 bg-success/10 text-success'
            : 'border-warning/30 bg-warning/10 text-warning',
        )}
      >
        {icon}
      </div>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function EmptyState({ label }: { readonly label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/50 p-3 text-sm text-muted-foreground">
      <CheckCircle2 className="size-4 text-success" />
      {label}
    </div>
  );
}

const severityVariant: Record<CodeQualitySeverity, 'destructive' | 'warning' | 'neutral'> = {
  error: 'destructive',
  warning: 'warning',
  info: 'neutral',
};

function summarizeAnalysis(analysis: CodeQualityAnalysis) {
  return {
    issueCount:
      analysis.lintIssues.length +
      analysis.duplications.length +
      analysis.complexity.filter((metric) => getComplexityScore(metric) >= 70).length,
    highComplexityCount: analysis.complexity.filter((metric) => getComplexityScore(metric) >= 70)
      .length,
  };
}

function getComplexityScore(metric: CodeQualityComplexityMetric) {
  return Math.max(metric.cyclomatic * 8, metric.cognitive * 6);
}

function getComplexityStatus(score: number) {
  if (score >= 70) return 'high';
  if (score >= 40) return 'moderate';
  return 'healthy';
}

function getComplexityVariant(score: number) {
  const status = getComplexityStatus(score);
  if (status === 'high') return 'destructive';
  if (status === 'moderate') return 'warning';
  return 'success';
}

function getLineHighlight(
  line: number,
  analysis: CodeQualityAnalysis,
  selectedLine: number | null,
) {
  if (line === selectedLine) {
    return 'bg-primary/15 ring-1 ring-primary/30';
  }

  if (analysis.lintIssues.some((issue) => issue.line === line)) {
    return 'bg-warning/10';
  }

  if (
    analysis.duplications.some(
      (item) =>
        (line >= item.startLine && line <= item.endLine) ||
        (line >= item.duplicateOfStartLine && line <= item.duplicateOfEndLine),
    )
  ) {
    return 'bg-destructive/10';
  }

  return 'hover:bg-muted/50';
}
