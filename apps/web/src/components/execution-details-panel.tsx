import type { ExecutionDetailsResponse } from '@syncode/contracts';
import type { TFunction } from 'i18next';
import { CheckCircle2, ChevronDown, ChevronRight, Clock, MemoryStick, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMb, formatMs, LineDiffBlock } from './room-workspace-utils.js';

type SubmissionVerdict = 'pending' | 'running' | 'failed' | 'accepted' | 'wrong-answer';

function getVerdict(details: ExecutionDetailsResponse): SubmissionVerdict {
  if (details.status === 'pending') return 'pending';
  if (details.status === 'running') return 'running';
  if (details.status === 'failed') return 'failed';

  const allPassed =
    details.totalTestCases > 0 &&
    details.passedTestCases === details.totalTestCases &&
    details.failedTestCases === 0 &&
    details.errorTestCases === 0;

  return allPassed ? 'accepted' : 'wrong-answer';
}

const VERDICT_STYLE: Record<SubmissionVerdict, { i18nKey: string; className: string }> = {
  pending: {
    i18nKey: 'execution.statusPending',
    className: 'text-muted-foreground border-border',
  },
  running: {
    i18nKey: 'execution.statusRunning',
    className: 'text-primary border-primary/40',
  },
  failed: {
    i18nKey: 'execution.statusFailed',
    className: 'text-destructive border-destructive/40',
  },
  accepted: {
    i18nKey: 'execution.statusAllPass',
    className: 'text-success border-success/40',
  },
  'wrong-answer': {
    i18nKey: 'execution.statusPartial',
    className: 'text-warning border-warning/40',
  },
};

interface ExecutionDetailsPanelProps {
  readonly details: ExecutionDetailsResponse;
  readonly className?: string;
}

export function ExecutionDetailsPanel({ details, className = '' }: ExecutionDetailsPanelProps) {
  const { t } = useTranslation('common');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const verdict = getVerdict(details);
  const style = VERDICT_STYLE[verdict];

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Verdict header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-foreground">
            {t('execution.details')}
          </span>
          <span
            className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${style.className}`}
          >
            {t(style.i18nKey)}
          </span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground/50">
          {formatMs(details.totalDurationMs)}
        </span>
      </div>

      {/* Stats row */}
      <div className="flex gap-3 font-mono text-[10px]">
        <span className="text-muted-foreground">
          {t('execution.total')}{' '}
          <span className="font-semibold text-foreground">{details.totalTestCases}</span>
        </span>
        <span className="text-muted-foreground">
          {t('execution.passed')}{' '}
          <span className="font-semibold text-success">{details.passedTestCases}</span>
        </span>
        <span className="text-muted-foreground">
          {t('execution.failed')}{' '}
          <span className="font-semibold text-destructive">{details.failedTestCases}</span>
        </span>
        {details.errorTestCases > 0 ? (
          <span className="text-muted-foreground">
            {t('execution.errors')}{' '}
            <span className="font-semibold text-warning">{details.errorTestCases}</span>
          </span>
        ) : null}
      </div>

      {/* Test case list */}
      <div className="space-y-1">
        {details.testCases.map((tc) => {
          const expanded = expandedIndex === tc.testCaseIndex;
          const passed = tc.passed === true;
          const failed = tc.passed === false;

          return (
            <div key={tc.testCaseIndex} className="rounded-md border border-border bg-card/50">
              {/* Case row */}
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpandedIndex(expanded ? null : tc.testCaseIndex)}
                className="flex w-full cursor-pointer items-center gap-2 px-2.5 py-1.5 text-left"
              >
                {expanded ? (
                  <ChevronDown className="size-3 shrink-0 text-primary" />
                ) : (
                  <ChevronRight className="size-3 shrink-0 text-muted-foreground/50" />
                )}

                <span className="font-mono text-[11px] text-foreground/80">
                  {t('execution.caseIndex', { index: tc.testCaseIndex + 1 })}
                </span>

                {/* Status pill */}
                <CaseStatusPill passed={passed} failed={failed} t={t} />

                {tc.timedOut ? (
                  <span className="font-mono text-[10px] font-semibold text-warning">
                    {t('execution.statusTimeout')}
                  </span>
                ) : null}

                {/* Metrics */}
                <div className="ml-auto flex items-center gap-3 font-mono text-[10px] text-muted-foreground/50">
                  <span className="flex items-center gap-0.5">
                    <Clock className="size-2.5" />
                    {formatMs(tc.durationMs)}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <MemoryStick className="size-2.5" />
                    {formatMb(tc.memoryUsageMb)}
                  </span>
                </div>
              </button>

              {/* Expanded detail */}
              {expanded ? (
                <div className="space-y-2 border-t border-border/60 px-2.5 py-2">
                  {/* Output diff (for failed cases) */}
                  {failed ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-destructive/80">
                        <XCircle className="size-3" />
                        {t('execution.outputDiff')}
                      </div>
                      <LineDiffBlock expected={tc.expectedOutput} actual={tc.actualOutput} />
                    </div>
                  ) : null}

                  {/* Expected / Actual side-by-side for passed cases too */}
                  {passed && tc.expectedOutput != null ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="font-mono text-[10px] uppercase text-muted-foreground/50">
                          {t('execution.expectedOutput')}
                        </span>
                        <pre className="mt-0.5 max-h-24 overflow-auto rounded border border-border bg-background p-2 font-mono text-[11px] text-foreground/80">
                          {tc.expectedOutput || t('execution.empty')}
                        </pre>
                      </div>
                      <div>
                        <span className="font-mono text-[10px] uppercase text-muted-foreground/50">
                          {t('execution.actualOutput')}
                        </span>
                        <pre className="mt-0.5 max-h-24 overflow-auto rounded border border-border bg-background p-2 font-mono text-[11px] text-success">
                          {tc.actualOutput || t('execution.empty')}
                        </pre>
                      </div>
                    </div>
                  ) : null}

                  {/* stdout / stderr */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="font-mono text-[10px] uppercase text-muted-foreground/50">
                        {t('execution.stdout')}
                      </span>
                      <pre className="mt-0.5 max-h-24 overflow-auto rounded border border-border bg-background p-2 font-mono text-[11px] text-foreground/80">
                        {tc.stdout || t('execution.empty')}
                      </pre>
                    </div>
                    <div>
                      <span className="font-mono text-[10px] uppercase text-muted-foreground/50">
                        {t('execution.stderr')}
                      </span>
                      <pre className="mt-0.5 max-h-24 overflow-auto rounded border border-border bg-background p-2 font-mono text-[11px] text-destructive/80">
                        {tc.stderr || tc.errorMessage || t('execution.empty')}
                      </pre>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CaseStatusPill({
  passed,
  failed,
  t,
}: {
  readonly passed: boolean;
  readonly failed: boolean;
  readonly t: TFunction<'common'>;
}) {
  if (passed) {
    return (
      <span className="flex items-center gap-0.5 font-mono text-[10px] font-semibold text-success">
        <CheckCircle2 className="size-3" />
        {t('execution.statusPass')}
      </span>
    );
  }
  if (failed) {
    return (
      <span className="flex items-center gap-0.5 font-mono text-[10px] font-semibold text-destructive">
        <XCircle className="size-3" />
        {t('execution.statusFail')}
      </span>
    );
  }
  return (
    <span className="font-mono text-[10px] text-muted-foreground/50">
      {t('execution.statusPending')}
    </span>
  );
}
