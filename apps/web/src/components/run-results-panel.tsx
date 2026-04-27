import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Play,
  TerminalSquare,
  XCircle,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type CaseRunState,
  countPassed,
  formatMb,
  formatMs,
  LineDiffBlock,
  type MultiRunState,
  type TestCaseEntry,
} from './room-workspace-utils.js';

interface RunResultsPanelProps {
  readonly multiRunState: MultiRunState;
  readonly cases: TestCaseEntry[];
  readonly onRunCase?: (caseId: string) => void;
}

function CaseCompletedDetails({
  state,
  failed,
  caseEntry,
  tc,
}: {
  readonly state: CaseRunState & { status: 'completed' | 'failed' };
  readonly failed: boolean;
  readonly caseEntry: TestCaseEntry;
  readonly tc: (key: string) => string;
}) {
  return (
    <div className="space-y-2 border-t border-border/60 px-2.5 py-2">
      {failed && caseEntry.expectedOutput != null ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-destructive/80">
            <XCircle className="size-3" />
            {tc('execution.outputDiff')}
          </div>
          <LineDiffBlock expected={caseEntry.expectedOutput} actual={state.stdout} />
        </div>
      ) : null}

      <div>
        <span className="font-mono text-[10px] uppercase text-muted-foreground/50">
          {tc('execution.stdout')}
        </span>
        <pre className="mt-0.5 max-h-24 overflow-auto rounded border border-border bg-background p-2 font-mono text-[11px] text-foreground/80">
          {state.stdout || tc('execution.empty')}
        </pre>
      </div>

      {state.stderr ? (
        <div>
          <span className="font-mono text-[10px] uppercase text-muted-foreground/50">
            {tc('execution.stderr')}
          </span>
          <pre className="mt-0.5 max-h-24 overflow-auto rounded border border-border bg-background p-2 font-mono text-[11px] text-destructive/80">
            {state.stderr}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

function CaseStatusBadge({
  passed,
  failed,
  isError,
  isLoading,
  done,
  t,
}: {
  readonly passed: boolean;
  readonly failed: boolean;
  readonly isError: boolean;
  readonly isLoading: boolean;
  readonly done: boolean;
  readonly t: (key: string) => string;
}) {
  if (passed) {
    return (
      <span className="flex items-center gap-0.5 font-mono text-[10px] font-semibold text-success">
        <CheckCircle2 className="size-3" />
        {t('workspace.casePass')}
      </span>
    );
  }
  if (failed) {
    return (
      <span className="flex items-center gap-0.5 font-mono text-[10px] font-semibold text-destructive">
        <XCircle className="size-3" />
        {t('workspace.caseFail')}
      </span>
    );
  }
  if (isError) {
    return (
      <span className="flex items-center gap-0.5 font-mono text-[10px] font-semibold text-destructive">
        <XCircle className="size-3" />
        error
      </span>
    );
  }
  if (isLoading) {
    return <Loader2 className="size-3 animate-spin text-primary" />;
  }
  if (done) {
    return <span className="font-mono text-[10px] text-muted-foreground">done</span>;
  }
  return (
    <span className="font-mono text-[10px] text-muted-foreground/50">
      {t('workspace.casePending')}
    </span>
  );
}

function CaseRow({
  caseEntry,
  state,
  expanded,
  onToggle,
  onRun,
}: {
  readonly caseEntry: TestCaseEntry;
  readonly state: CaseRunState | undefined;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly onRun?: () => void;
}) {
  const { t } = useTranslation('rooms');
  const { t: tc } = useTranslation('common');

  const isCompleted = state?.status === 'completed' || state?.status === 'failed';
  const isError = state?.status === 'request-error';
  const passed = isCompleted && state.passed === true;
  const failed = isCompleted && state.passed === false;
  const done = isCompleted && state.passed === null;
  const isLoading = state?.status === 'queued' || state?.status === 'running';

  return (
    <div className="rounded-md border border-border bg-card/50">
      <div className="flex items-center">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={onToggle}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-2.5 py-1.5 text-left"
        >
          {expanded ? (
            <ChevronDown className="size-3 shrink-0 text-primary" />
          ) : (
            <ChevronRight className="size-3 shrink-0 text-muted-foreground/50" />
          )}

          <span className="font-mono text-[11px] text-foreground/80">{caseEntry.label}</span>

          <CaseStatusBadge
            passed={passed}
            failed={failed}
            isError={isError}
            isLoading={isLoading}
            done={done}
            t={t}
          />

          {isCompleted && state.timedOut ? (
            <span className="font-mono text-[10px] font-semibold text-warning">TLE</span>
          ) : null}

          {isCompleted ? (
            <div className="ml-auto flex items-center gap-3 font-mono text-[10px] text-muted-foreground/50">
              <span>{formatMs(state.durationMs)}</span>
              {state.memoryUsageMb != null ? <span>{formatMb(state.memoryUsageMb)}</span> : null}
            </div>
          ) : null}
        </button>

        {onRun ? (
          <button
            type="button"
            onClick={onRun}
            className="shrink-0 rounded p-1.5 text-muted-foreground/50 transition-colors hover:text-primary"
            title={t('workspace.runCode')}
          >
            <Play className="size-3" />
          </button>
        ) : null}
      </div>

      {/* Expanded detail */}
      {expanded && isCompleted ? (
        <CaseCompletedDetails state={state} failed={failed} caseEntry={caseEntry} tc={tc} />
      ) : null}

      {expanded && isError ? (
        <div className="border-t border-border/60 px-2.5 py-2">
          <p className="font-mono text-xs text-destructive">{state.message}</p>
        </div>
      ) : null}
    </div>
  );
}

export function RunResultsPanel({ multiRunState, cases, onRunCase }: RunResultsPanelProps) {
  const { t } = useTranslation('rooms');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleToggle = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  if (multiRunState.status === 'idle') {
    return (
      <div className="relative flex flex-col items-center justify-center py-8 text-center">
        <div className="pointer-events-none dot-grid absolute inset-0 opacity-[0.03]" />
        <TerminalSquare className="relative mb-2 size-5 text-muted-foreground/20" />
        <p className="relative font-mono text-xs text-muted-foreground/40">
          {t('workspace.noOutput')}
        </p>
      </div>
    );
  }

  if (multiRunState.status === 'request-error') {
    return <p className="font-mono text-xs text-destructive">{multiRunState.message}</p>;
  }

  const { passed, total } = countPassed(multiRunState.results);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs font-semibold text-foreground">
          {t('workspace.runResults')}
        </span>
        {total > 0 ? (
          <span className="font-mono text-[10px] text-muted-foreground">
            {t('workspace.runResultsSummary', { passed, total })}
          </span>
        ) : null}
      </div>

      <div className="space-y-1">
        {cases.map((caseEntry) => (
          <CaseRow
            key={caseEntry.id}
            caseEntry={caseEntry}
            state={multiRunState.results.get(caseEntry.id)}
            expanded={expandedId === caseEntry.id}
            onToggle={() => handleToggle(caseEntry.id)}
            onRun={onRunCase ? () => onRunCase(caseEntry.id) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
