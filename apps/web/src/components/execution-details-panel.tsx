import type { ExecutionDetailsResponse } from '@syncode/contracts';
import { ChevronDown, ChevronRight, Cpu, Gauge, MemoryStick, XCircle } from 'lucide-react';
import { useState } from 'react';

type DiffLine = {
  kind: 'same' | 'expected' | 'actual';
  text: string;
};

// Build a stable line diff using LCS so insertions/deletions do not shift all following lines.
function buildLineDiff(expectedOutput: string | null, actualOutput: string | null): DiffLine[] {
  const expectedLines = (expectedOutput ?? '').split('\n');
  const actualLines = (actualOutput ?? '').split('\n');
  const expectedLength = expectedLines.length;
  const actualLength = actualLines.length;
  const lcsTable = Array.from({ length: expectedLength + 1 }, () =>
    Array.from({ length: actualLength + 1 }, () => 0),
  );

  for (let expectedIndex = expectedLength - 1; expectedIndex >= 0; expectedIndex--) {
    for (let actualIndex = actualLength - 1; actualIndex >= 0; actualIndex--) {
      const nextExpected = lcsTable[expectedIndex + 1] ?? [];
      const currentExpected = lcsTable[expectedIndex] ?? [];
      lcsTable[expectedIndex]![actualIndex] =
        expectedLines[expectedIndex] === actualLines[actualIndex]
          ? (nextExpected[actualIndex + 1] ?? 0) + 1
          : Math.max(nextExpected[actualIndex] ?? 0, currentExpected[actualIndex + 1] ?? 0);
    }
  }

  const diff: DiffLine[] = [];
  let expectedIndex = 0;
  let actualIndex = 0;

  while (expectedIndex < expectedLength && actualIndex < actualLength) {
    if (expectedLines[expectedIndex] === actualLines[actualIndex]) {
      diff.push({ kind: 'same', text: expectedLines[expectedIndex]! });
      expectedIndex++;
      actualIndex++;
      continue;
    }

    const nextExpected = lcsTable[expectedIndex + 1] ?? [];
    const currentExpected = lcsTable[expectedIndex] ?? [];

    if ((nextExpected[actualIndex] ?? 0) >= (currentExpected[actualIndex + 1] ?? 0)) {
      diff.push({ kind: 'expected', text: expectedLines[expectedIndex]! });
      expectedIndex++;
    } else {
      diff.push({ kind: 'actual', text: actualLines[actualIndex]! });
      actualIndex++;
    }
  }

  while (expectedIndex < expectedLength) {
    diff.push({ kind: 'expected', text: expectedLines[expectedIndex]! });
    expectedIndex++;
  }

  while (actualIndex < actualLength) {
    diff.push({ kind: 'actual', text: actualLines[actualIndex]! });
    actualIndex++;
  }

  return diff.filter((line, index, lines) => !(line.text === '' && index === lines.length - 1));
}

function formatMillis(value: number | null): string {
  if (value === null) {
    return '--';
  }

  return `${value}ms`;
}

function formatMemory(value: number | null): string {
  if (value === null) {
    return '--';
  }

  return `${value.toFixed(1)} MB`;
}

function formatBarLabel(current: number | null, limit: number | null): string {
  if (current === null || limit === null) {
    return '--';
  }

  return `${current} / ${limit}`;
}

function getSubmissionStatusDisplay(details: ExecutionDetailsResponse): {
  label: string;
  badgeClass: string;
} {
  if (details.status === 'pending') {
    return {
      label: 'pending',
      badgeClass: 'border-zinc-700 bg-zinc-900 text-zinc-300',
    };
  }

  if (details.status === 'running') {
    return {
      label: 'running',
      badgeClass: 'border-cyan-700/60 bg-cyan-950/30 text-cyan-300',
    };
  }

  if (details.status === 'failed') {
    return {
      label: 'failed',
      badgeClass: 'border-rose-700/60 bg-rose-950/30 text-rose-300',
    };
  }

  const allPassed =
    details.totalTestCases > 0 &&
    details.passedTestCases === details.totalTestCases &&
    details.failedTestCases === 0 &&
    details.errorTestCases === 0;

  if (allPassed) {
    return {
      label: 'completed-all-pass',
      badgeClass: 'border-emerald-700/60 bg-emerald-950/30 text-emerald-300',
    };
  }

  return {
    label: 'completed-partial',
    badgeClass: 'border-amber-700/60 bg-amber-950/30 text-amber-300',
  };
}

interface ExecutionDetailsPanelProps {
  details: ExecutionDetailsResponse;
  className?: string;
}

export function ExecutionDetailsPanel({ details, className = '' }: ExecutionDetailsPanelProps) {
  const [expandedCaseIndex, setExpandedCaseIndex] = useState<number | null>(null);
  const statusDisplay = getSubmissionStatusDisplay(details);

  const durationLimitMs = details.testCases.reduce((limit, testCase) => {
    const configuredLimit = testCase.timedOut
      ? (testCase.durationMs ?? 0)
      : (testCase.durationMs ?? 0);
    return Math.max(limit, configuredLimit, 2000);
  }, 2000);
  const memoryLimitMb = details.testCases.reduce((limit, testCase) => {
    return Math.max(limit, testCase.memoryUsageMb ?? 0, 128);
  }, 128);

  // Accordion behavior: opening one case closes the others.
  const toggleCaseExpanded = (testCaseIndex: number) => {
    setExpandedCaseIndex((prev) => (prev === testCaseIndex ? null : testCaseIndex));
  };

  return (
    <section
      className={`rounded-2xl border border-[oklch(0.6_0.22_165/0.7)] bg-zinc-950/70 p-6 text-zinc-100 shadow-[0_0_35px_oklch(0.6_0.22_165/0.35),0_10px_35px_-15px_rgba(0,0,0,0.6)] ${className}`}
    >
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[oklch(0.88_0.22_165)] drop-shadow-[0_0_10px_oklch(0.88_0.22_165/0.5)]">
            Execution Details
          </h2>
          <p className="mt-1 text-xs text-[oklch(0.88_0.22_165/0.85)]">
            Tip: click a case arrow to view that case log viewer.
          </p>
          <p className="mt-1 text-xs text-zinc-400">Submission {details.submissionId}</p>
        </div>
        <span
          className={`rounded-md border px-2.5 py-1 font-mono text-xs uppercase ${statusDisplay.badgeClass}`}
        >
          {statusDisplay.label}
        </span>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">Total</p>
          <p className="text-lg font-semibold">{details.totalTestCases}</p>
        </div>
        <div className="rounded-lg border border-emerald-700/40 bg-emerald-950/20 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-emerald-400/70">Passed</p>
          <p className="text-lg font-semibold text-emerald-300">{details.passedTestCases}</p>
        </div>
        <div className="rounded-lg border border-rose-700/40 bg-rose-950/20 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-rose-400/70">Failed</p>
          <p className="text-lg font-semibold text-rose-300">{details.failedTestCases}</p>
        </div>
        <div className="rounded-lg border border-amber-700/40 bg-amber-950/20 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-amber-400/70">Errors</p>
          <p className="text-lg font-semibold text-amber-300">{details.errorTestCases}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">Total Time</p>
          <p className="text-lg font-semibold">{formatMillis(details.totalDurationMs)}</p>
        </div>
      </div>

      <div className="space-y-3">
        {details.testCases.map((testCase) => {
          const expanded = expandedCaseIndex === testCase.testCaseIndex;
          const isFailed = testCase.passed === false;
          const durationPercent = ((testCase.durationMs ?? 0) / durationLimitMs) * 100;
          const memoryPercent = ((testCase.memoryUsageMb ?? 0) / memoryLimitMb) * 100;

          return (
            <article
              key={testCase.testCaseIndex}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40"
            >
              <button
                type="button"
                onClick={() => toggleCaseExpanded(testCase.testCaseIndex)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <div className="flex items-center gap-3">
                  {expanded ? (
                    <ChevronDown
                      size={20}
                      strokeWidth={3}
                      className="text-[oklch(0.88_0.22_165)] drop-shadow-[0_0_8px_oklch(0.88_0.22_165/0.7)]"
                    />
                  ) : (
                    <ChevronRight
                      size={20}
                      strokeWidth={3}
                      className="text-[oklch(0.88_0.22_165)] drop-shadow-[0_0_8px_oklch(0.88_0.22_165/0.7)]"
                    />
                  )}
                  <span className="font-mono text-sm">Case #{testCase.testCaseIndex + 1}</span>
                  <span
                    className={`rounded px-2 py-0.5 text-[11px] font-semibold uppercase ${
                      testCase.passed === true
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : testCase.passed === false
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-zinc-700/50 text-zinc-300'
                    }`}
                  >
                    {testCase.passed === true
                      ? 'pass'
                      : testCase.passed === false
                        ? 'fail'
                        : 'pending'}
                  </span>
                  {testCase.timedOut && (
                    <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold uppercase text-amber-300">
                      timeout
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-zinc-400">
                  <span className="inline-flex items-center gap-1">
                    <Gauge size={14} />
                    {formatMillis(testCase.durationMs)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MemoryStick size={14} />
                    {formatMemory(testCase.memoryUsageMb)}
                  </span>
                </div>
              </button>

              <div className="px-4 pb-4">
                <div className="mb-3 grid gap-2 md:grid-cols-2">
                  <div>
                    <div className="mb-1 inline-flex items-center gap-1 text-[11px] uppercase text-zinc-500">
                      <Cpu size={13} /> Duration (
                      {formatBarLabel(testCase.durationMs, durationLimitMs)} ms)
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-cyan-400/80"
                        style={{ width: `${Math.min(100, durationPercent)}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 inline-flex items-center gap-1 text-[11px] uppercase text-zinc-500">
                      <MemoryStick size={13} /> Memory (
                      {formatBarLabel(testCase.memoryUsageMb, memoryLimitMb)} MB)
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-violet-400/80"
                        style={{ width: `${Math.min(100, memoryPercent)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {expanded && (
                  <div className="animate-in fade-in slide-in-from-top-1 duration-200 space-y-3">
                    {isFailed && (
                      <div className="rounded-lg border border-rose-600/30 bg-rose-950/20 p-3">
                        <div className="mb-2 inline-flex items-center gap-1 text-xs font-semibold uppercase text-rose-300">
                          <XCircle size={14} /> Output Diff
                        </div>
                        <pre className="max-h-56 overflow-auto rounded bg-zinc-950 p-3 text-xs">
                          {buildLineDiff(testCase.expectedOutput, testCase.actualOutput).map(
                            (line, index) => {
                              const prefix =
                                line.kind === 'same'
                                  ? '  '
                                  : line.kind === 'expected'
                                    ? '- '
                                    : '+ ';
                              const colorClass =
                                line.kind === 'same'
                                  ? 'text-zinc-400'
                                  : line.kind === 'expected'
                                    ? 'text-emerald-300'
                                    : 'text-rose-300';

                              return (
                                <div
                                  key={`${line.kind}-${index}-${line.text}`}
                                  className={colorClass}
                                >
                                  {prefix}
                                  {line.text}
                                </div>
                              );
                            },
                          )}
                        </pre>
                      </div>
                    )}

                    <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                      <h3 className="mb-2 text-sm font-semibold">Execution Log Viewer</h3>
                      <div className="space-y-3 text-xs">
                        <p className="font-mono text-zinc-400">
                          Case #{testCase.testCaseIndex + 1}
                        </p>
                        <div>
                          <p className="mb-1 font-semibold text-zinc-300">stdout</p>
                          <pre className="max-h-40 overflow-auto rounded bg-zinc-950 p-3 text-zinc-300">
                            {testCase.stdout || '(empty)'}
                          </pre>
                        </div>
                        <div>
                          <p className="mb-1 font-semibold text-zinc-300">stderr</p>
                          <pre className="max-h-40 overflow-auto rounded bg-zinc-950 p-3 text-rose-300">
                            {testCase.stderr || testCase.errorMessage || '(empty)'}
                          </pre>
                        </div>
                      </div>
                    </section>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
