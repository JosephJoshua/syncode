import type {
  StaticAnalysisDiagnostic,
  StaticAnalysisDuplication,
  StaticAnalysisResultResponse,
} from '@syncode/contracts';
import { cn } from '@syncode/ui';
import { CheckCircle2, Copy, Loader2, ScanSearch, TriangleAlert, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type StaticAnalysisPanelState =
  | { status: 'idle' }
  | { status: 'request-error'; message: string }
  | { status: 'pending' }
  | StaticAnalysisResultResponse;

interface StaticAnalysisPanelProps {
  readonly analysis: StaticAnalysisPanelState;
}

export function StaticAnalysisPanel({ analysis }: StaticAnalysisPanelProps) {
  const { t } = useTranslation('rooms');

  if (analysis.status === 'idle') {
    return null;
  }

  if (analysis.status === 'request-error') {
    return (
      <section className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5">
        <div className="flex items-center gap-2">
          <XCircle className="size-3.5 text-destructive" />
          <span className="font-mono text-xs font-semibold text-destructive">
            {t('workspace.staticAnalysisTitle')}
          </span>
        </div>
        <p className="mt-1 font-mono text-[11px] text-destructive/80">{analysis.message}</p>
      </section>
    );
  }

  if (analysis.status === 'pending') {
    return (
      <section className="rounded-md border border-border bg-card/50 p-2.5">
        <div className="flex items-center gap-2">
          <Loader2 className="size-3.5 animate-spin text-primary" />
          <span className="font-mono text-xs font-semibold text-foreground">
            {t('workspace.staticAnalysisTitle')}
          </span>
          <span className="font-mono text-[10px] text-primary/80">
            {t('workspace.staticAnalysisPending')}
          </span>
        </div>
      </section>
    );
  }

  const topDiagnostics = analysis.diagnostics.slice(0, 4);
  const topComplexity = [...analysis.complexity]
    .sort((a, b) => b.cyclomaticComplexity - a.cyclomaticComplexity)
    .slice(0, 2);
  const topDuplications = analysis.duplications.slice(0, 2);
  const failedTools = analysis.toolResults.filter((tool) => tool.status === 'failed').slice(0, 3);
  const hasNoFindings =
    topDiagnostics.length === 0 &&
    topComplexity.length === 0 &&
    topDuplications.length === 0 &&
    failedTools.length === 0;

  return (
    <section className="space-y-2.5 rounded-md border border-border bg-card/50 p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <ScanSearch className="size-3.5 text-primary" />
        <span className="font-mono text-xs font-semibold text-foreground">
          {t('workspace.staticAnalysisTitle')}
        </span>
        <AnalysisStatusBadge status={analysis.status} />
        <span className="ml-auto font-mono text-[10px] text-muted-foreground/60">
          {analysis.source === 'submission'
            ? t('workspace.staticAnalysisSubmission')
            : t('workspace.staticAnalysisRun')}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
        <AnalysisMetric
          label={t('workspace.staticAnalysisDiagnostics')}
          value={analysis.summary.diagnosticCount}
          tone={analysis.summary.errorCount > 0 ? 'danger' : 'default'}
        />
        <AnalysisMetric
          label={t('workspace.staticAnalysisComplexity')}
          value={analysis.summary.maxCyclomaticComplexity ?? '--'}
          tone={analysis.summary.highComplexityCount > 0 ? 'warning' : 'default'}
        />
        <AnalysisMetric
          label={t('workspace.staticAnalysisDuplication')}
          value={analysis.summary.duplicationCount}
          tone={analysis.summary.duplicationCount > 0 ? 'warning' : 'default'}
        />
        <AnalysisMetric
          label={t('workspace.staticAnalysisTools')}
          value={analysis.summary.toolFailureCount}
          tone={analysis.summary.toolFailureCount > 0 ? 'warning' : 'default'}
        />
      </div>

      {hasNoFindings ? (
        <div className="flex items-center gap-1.5 rounded border border-success/20 bg-success/5 px-2 py-1.5 font-mono text-[11px] text-success">
          <CheckCircle2 className="size-3" />
          {t('workspace.staticAnalysisClean')}
        </div>
      ) : (
        <div className="space-y-1">
          {topDiagnostics.map((diagnostic, index) => (
            <DiagnosticFinding
              key={`${diagnostic.tool}-${diagnostic.rule ?? 'rule'}-${index}`}
              diagnostic={diagnostic}
            />
          ))}
          {topComplexity.map((item, index) => (
            <div
              key={`${item.tool}-${item.functionName}-${item.startLine}-${index}`}
              className="flex min-w-0 items-center gap-2 rounded border border-border/80 bg-background px-2 py-1.5"
            >
              <TriangleAlert className="size-3 shrink-0 text-warning" />
              <span className="min-w-0 truncate font-mono text-[11px] text-foreground/80">
                {t('workspace.staticAnalysisComplexityFinding', {
                  name: item.functionName,
                  value: item.cyclomaticComplexity,
                })}
              </span>
              <LocationText file={item.file} line={item.startLine} />
            </div>
          ))}
          {topDuplications.map((duplication, index) => (
            <DuplicationFinding
              key={`${duplication.tool}-${duplication.lines}-${index}`}
              duplication={duplication}
            />
          ))}
          {failedTools.map((tool) => (
            <div
              key={tool.tool}
              className="flex min-w-0 items-center gap-2 rounded border border-warning/30 bg-warning/5 px-2 py-1.5"
            >
              <TriangleAlert className="size-3 shrink-0 text-warning" />
              <span className="min-w-0 truncate font-mono text-[11px] text-warning">
                {t('workspace.staticAnalysisToolFailed', { tool: tool.tool })}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AnalysisStatusBadge({ status }: { readonly status: 'completed' | 'failed' }) {
  const { t } = useTranslation('rooms');
  return (
    <span
      className={cn(
        'rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase',
        status === 'completed'
          ? 'border-success/40 text-success'
          : 'border-warning/40 text-warning',
      )}
    >
      {status === 'completed'
        ? t('workspace.staticAnalysisCompleted')
        : t('workspace.staticAnalysisFailed')}
    </span>
  );
}

function AnalysisMetric({
  label,
  value,
  tone,
}: {
  readonly label: string;
  readonly value: number | string;
  readonly tone: 'default' | 'warning' | 'danger';
}) {
  return (
    <div className="rounded border border-border/80 bg-background px-2 py-1.5">
      <div className="font-mono text-[10px] text-muted-foreground/60">{label}</div>
      <div
        className={cn(
          'font-mono text-sm font-semibold',
          tone === 'danger' && 'text-destructive',
          tone === 'warning' && 'text-warning',
          tone === 'default' && 'text-foreground',
        )}
      >
        {value}
      </div>
    </div>
  );
}

function DiagnosticFinding({ diagnostic }: { readonly diagnostic: StaticAnalysisDiagnostic }) {
  const severityClass =
    diagnostic.severity === 'error'
      ? 'text-destructive'
      : diagnostic.severity === 'warning'
        ? 'text-warning'
        : 'text-muted-foreground';

  return (
    <div className="flex min-w-0 items-center gap-2 rounded border border-border/80 bg-background px-2 py-1.5">
      {diagnostic.severity === 'error' ? (
        <XCircle className="size-3 shrink-0 text-destructive" />
      ) : (
        <TriangleAlert className={cn('size-3 shrink-0', severityClass)} />
      )}
      <span className={cn('shrink-0 font-mono text-[10px] uppercase', severityClass)}>
        {diagnostic.tool}
      </span>
      <span className="min-w-0 truncate font-mono text-[11px] text-foreground/80">
        {diagnostic.message}
      </span>
      <LocationText file={diagnostic.file} line={diagnostic.line} />
    </div>
  );
}

function DuplicationFinding({ duplication }: { readonly duplication: StaticAnalysisDuplication }) {
  const { t } = useTranslation('rooms');
  const firstOccurrence = duplication.occurrences[0];

  return (
    <div className="flex min-w-0 items-center gap-2 rounded border border-border/80 bg-background px-2 py-1.5">
      <Copy className="size-3 shrink-0 text-warning" />
      <span className="min-w-0 truncate font-mono text-[11px] text-foreground/80">
        {t('workspace.staticAnalysisDuplicationFinding', { lines: duplication.lines })}
      </span>
      <LocationText
        file={firstOccurrence?.file ?? null}
        line={firstOccurrence?.startLine ?? null}
      />
    </div>
  );
}

function LocationText({
  file,
  line,
}: {
  readonly file: string | null;
  readonly line: number | null;
}) {
  if (!file && line == null) {
    return null;
  }

  return (
    <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground/50">
      {[file, line == null ? null : `L${line}`].filter(Boolean).join(':')}
    </span>
  );
}
