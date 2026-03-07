import { CheckCircle2, ChevronDown, ChevronRight, Clock, HardDrive, XCircle } from 'lucide-react';
import { useState } from 'react';

// ─── Mock Data ──────────────────────────────────────────────────────────────

interface TestCase {
  label: string;
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
}

const ALL_PASS_CASES: TestCase[] = [
  {
    label: 'Test Case 1',
    input: 'nums = [2,7,11,15], target = 9',
    expected: '[0,1]',
    actual: '[0,1]',
    passed: true,
  },
  {
    label: 'Test Case 2',
    input: 'nums = [3,2,4], target = 6',
    expected: '[1,2]',
    actual: '[1,2]',
    passed: true,
  },
  {
    label: 'Test Case 3',
    input: 'nums = [3,3], target = 6',
    expected: '[0,1]',
    actual: '[0,1]',
    passed: true,
  },
];

const SOME_FAIL_CASES: TestCase[] = [
  {
    label: 'Test Case 1',
    input: 'nums = [2,7,11,15], target = 9',
    expected: '[0,1]',
    actual: '[0,1]',
    passed: true,
  },
  {
    label: 'Test Case 2',
    input: 'nums = [3,2,4], target = 6',
    expected: '[1,2]',
    actual: '[1,2]',
    passed: true,
  },
  {
    label: 'Test Case 3',
    input: 'nums = [3,3], target = 6',
    expected: '[0,1]',
    actual: '[1,0]',
    passed: false,
  },
];

// ─── Test Case Card ─────────────────────────────────────────────────────────

function TestCaseCard({ tc }: { tc: TestCase }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-[var(--bg-raised)] border border-[var(--border-default)] rounded-lg p-3 mb-2">
      <button
        type="button"
        className="w-full flex items-center gap-2 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        {tc.passed ? (
          <CheckCircle2 size={14} className="text-[var(--success)] flex-none" />
        ) : (
          <XCircle size={14} className="text-[var(--error)] flex-none" />
        )}
        <span className="font-mono text-xs font-medium text-[var(--text-primary)] flex-1">
          {tc.label}
        </span>
        {expanded ? (
          <ChevronDown size={12} className="text-[var(--text-tertiary)]" />
        ) : (
          <ChevronRight size={12} className="text-[var(--text-tertiary)]" />
        )}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {/* Input */}
          <div>
            <span className="font-mono text-[10px] text-[var(--text-tertiary)]">Input:</span>
            <div className="bg-[var(--bg-subtle)] rounded p-2 font-mono text-xs text-[var(--text-primary)] mt-0.5">
              {tc.input}
            </div>
          </div>

          {/* Expected */}
          <div>
            <span className="font-mono text-[10px] text-[var(--text-tertiary)]">Expected:</span>
            <div
              className={`rounded p-2 font-mono text-xs mt-0.5 ${
                tc.passed
                  ? 'bg-[var(--bg-subtle)] text-[var(--text-primary)]'
                  : 'bg-[rgba(34,197,94,0.05)] border-l-2 border-[var(--success)] text-[var(--text-primary)]'
              }`}
            >
              {tc.expected}
            </div>
          </div>

          {/* Actual */}
          <div>
            <span className="font-mono text-[10px] text-[var(--text-tertiary)]">Actual:</span>
            <div
              className={`rounded p-2 font-mono text-xs mt-0.5 ${
                tc.passed
                  ? 'bg-[var(--bg-subtle)] text-[var(--success)]'
                  : 'bg-[rgba(239,68,68,0.05)] border-l-2 border-[var(--error)] text-[var(--error)]'
              }`}
            >
              {tc.actual}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Output Panel ───────────────────────────────────────────────────────────

export function OutputPanel() {
  const [activeTab, setActiveTab] = useState<'output' | 'testcases'>('output');
  const [allPass, setAllPass] = useState(true);

  const testCases = allPass ? ALL_PASS_CASES : SOME_FAIL_CASES;
  const passCount = testCases.filter((tc) => tc.passed).length;
  const total = testCases.length;

  return (
    <div className="flex flex-col h-full">
      {/* Tab Bar */}
      <div className="h-8 flex items-center px-3 border-b border-[var(--border-default)] bg-[var(--bg-raised)] flex-none">
        <div className="flex items-center gap-0">
          <button
            type="button"
            className={`font-mono text-xs px-2 py-1.5 cursor-pointer transition-colors ${
              activeTab === 'output'
                ? 'text-[var(--text-primary)] border-b-2 border-[var(--accent)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
            onClick={() => setActiveTab('output')}
          >
            Output
          </button>
          <button
            type="button"
            className={`font-mono text-xs px-2 py-1.5 cursor-pointer transition-colors ${
              activeTab === 'testcases'
                ? 'text-[var(--text-primary)] border-b-2 border-[var(--accent)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
            onClick={() => setActiveTab('testcases')}
          >
            Test Cases
          </button>
        </div>

        {/* Dev toggle */}
        <button
          type="button"
          className="ml-auto font-mono text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] cursor-pointer transition-colors"
          onClick={() => setAllPass(!allPass)}
        >
          {allPass ? 'Show failures' : 'Show all pass'}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'output' ? (
          /* Output Tab */
          <div>
            <pre className="font-mono text-xs text-[var(--text-secondary)] whitespace-pre-wrap">
              {`> Running solution...

[0, 1]

Execution time: 2ms
Memory: 42.1 MB`}
            </pre>

            <div className="flex items-center gap-2 mt-3">
              <span className="inline-flex items-center gap-1 bg-[var(--bg-subtle)] rounded-full px-2 py-0.5 font-mono text-[10px] text-[var(--text-secondary)]">
                <Clock size={12} />
                2ms
              </span>
              <span className="inline-flex items-center gap-1 bg-[var(--bg-subtle)] rounded-full px-2 py-0.5 font-mono text-[10px] text-[var(--text-secondary)]">
                <HardDrive size={12} />
                42.1 MB
              </span>
            </div>
          </div>
        ) : (
          /* Test Cases Tab */
          <div>
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              {passCount === total ? (
                <CheckCircle2 size={16} className="text-[var(--success)]" />
              ) : (
                <CheckCircle2 size={16} className="text-[var(--warning)]" />
              )}
              <span
                className={`font-mono text-sm ${
                  passCount === total ? 'text-[var(--success)]' : 'text-[var(--warning)]'
                }`}
              >
                {passCount}/{total} passed
              </span>
            </div>

            {/* Test case cards */}
            {testCases.map((tc, i) => (
              <TestCaseCard key={i} tc={tc} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
