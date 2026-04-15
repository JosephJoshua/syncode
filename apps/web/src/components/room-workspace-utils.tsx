import type { BeforeMount } from '@monaco-editor/react';
import type { ExecutionDetailsResponse } from '@syncode/contracts';
import type { SupportedLanguage } from '@syncode/shared';
import { Loader2 } from 'lucide-react';
import { buildLineDiff } from '@/lib/line-diff.js';

const MONACO_LANGUAGE_MAP: Record<SupportedLanguage, string> = {
  python: 'python',
  javascript: 'javascript',
  typescript: 'typescript',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  go: 'go',
  rust: 'rust',
};

export function toMonacoLanguage(language: SupportedLanguage): string {
  return MONACO_LANGUAGE_MAP[language];
}

export type SubmitState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'polling'; submissionId: string }
  | { status: 'completed'; submissionId: string; details: ExecutionDetailsResponse }
  | { status: 'request-error'; message: string };

export const EXECUTION_POLL_INTERVAL_MS = 1_200;
export const SUBMISSION_POLL_INTERVAL_MS = 1_500;

export interface TestCaseEntry {
  id: string;
  input: string;
  expectedOutput: string | null;
  label: string;
  fromProblem: boolean;
}

export type CaseRunState =
  | { status: 'queued' }
  | { status: 'running'; jobId: string }
  | {
      status: 'completed' | 'failed';
      jobId: string;
      stdout: string;
      stderr: string;
      exitCode: number;
      durationMs: number;
      memoryUsageMb?: number;
      timedOut: boolean;
      error?: string;
      passed: boolean | null;
    }
  | { status: 'request-error'; message: string };

export type MultiRunState =
  | { status: 'idle' }
  | { status: 'running'; results: Map<string, CaseRunState> }
  | { status: 'completed'; results: Map<string, CaseRunState> }
  | { status: 'request-error'; message: string };

export function countPassed(results: Map<string, CaseRunState>): {
  passed: number;
  total: number;
} {
  let passed = 0;
  let total = 0;
  for (const state of results.values()) {
    if (state.status === 'completed' || state.status === 'failed') {
      total++;
      if (state.passed === true) passed++;
    }
  }
  return { passed, total };
}

export function formatMs(value: number | null): string {
  return value === null ? '--' : `${value}ms`;
}

export function formatMb(value: number | null): string {
  return value === null ? '--' : `${value.toFixed(1)}MB`;
}

export function tabClassName(active: boolean): string {
  return `flex items-center gap-1.5 border-b-2 px-3 py-1 font-mono text-[10px] transition-colors ${
    active
      ? 'border-primary text-foreground/80'
      : 'border-transparent text-muted-foreground/50 hover:text-muted-foreground/70'
  }`;
}

export function LineDiffBlock({
  expected,
  actual,
}: {
  expected: string | null;
  actual: string | null;
}) {
  const lines = buildLineDiff(expected, actual);

  return (
    <pre className="max-h-40 overflow-auto rounded border border-border bg-background p-2 font-mono text-[11px] leading-relaxed">
      {lines.map((line, i) => {
        const prefix = line.kind === 'same' ? '  ' : line.kind === 'expected' ? '- ' : '+ ';
        const color =
          line.kind === 'same'
            ? 'text-muted-foreground'
            : line.kind === 'expected'
              ? 'text-success'
              : 'text-destructive';

        return (
          <div key={`${line.kind}-${i}`} className={color}>
            {prefix}
            {line.text}
          </div>
        );
      })}
    </pre>
  );
}

export const handleEditorWillMount: BeforeMount = (monaco) => {
  monaco.editor.defineTheme('syncode-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '9e9eab', fontStyle: 'italic' },
      { token: 'keyword', foreground: '00e599' },
      { token: 'string', foreground: 'f59e0b' },
      { token: 'number', foreground: '22d3ee' },
      { token: 'type', foreground: '818cf8' },
      { token: 'function', foreground: '60a5fa' },
    ],
    colors: {
      'editor.background': '#242429',
      'editor.foreground': '#fafafa',
      'editor.lineHighlightBackground': '#2e2e3440',
      'editorLineNumber.foreground': '#3a3a41',
      'editorLineNumber.activeForeground': '#9e9eab',
      'editor.selectionBackground': '#00e59920',
      'editorCursor.foreground': '#00e599',
      'editor.inactiveSelectionBackground': '#00e59910',
      'editorIndentGuide.background': '#3a3a41',
      'editorIndentGuide.activeBackground': '#4a4a52',
      'editor.selectionHighlightBackground': '#00e59910',
      'editorBracketMatch.background': '#00e59915',
      'editorBracketMatch.border': '#00e59940',
    },
  });
};

export function getDefaultCode(language: string): string {
  switch (language) {
    case 'python':
      return '# Write your solution here\n\n';
    case 'javascript':
      return '// Write your solution here\n\n';
    case 'typescript':
      return '// Write your solution here\n\n';
    case 'java':
      return 'public class Main {\n  public static void main(String[] args) {\n    // Write your solution here\n  }\n}\n';
    case 'cpp':
      return '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  // Write your solution here\n  return 0;\n}\n';
    case 'c':
      return '#include <stdio.h>\n\nint main(void) {\n  // Write your solution here\n  return 0;\n}\n';
    case 'go':
      return 'package main\n\nfunc main() {\n  // Write your solution here\n}\n';
    case 'rust':
      return 'fn main() {\n    // Write your solution here\n}\n';
    default:
      return '# Write your solution here\n\n';
  }
}

export const EDITOR_OPTIONS_BASE = {
  fontSize: 14,
  fontFamily: "'Geist Mono', 'IBM Plex Mono', 'Fira Code', monospace",
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  padding: { top: 12, bottom: 12 },
  lineNumbers: 'on' as const,
  renderLineHighlight: 'line' as const,
  cursorBlinking: 'smooth' as const,
  smoothScrolling: true,
  bracketPairColorization: { enabled: true },
  guides: { indentation: true },
  tabSize: 2,
  wordWrap: 'off' as const,
  automaticLayout: true,
};

export const EDITOR_LOADING = (
  <div className="flex size-full items-center justify-center bg-card">
    <Loader2 className="size-6 animate-spin text-primary" />
  </div>
);

export function languageExtension(language: string): string {
  switch (language) {
    case 'python':
      return 'py';
    case 'javascript':
      return 'js';
    case 'typescript':
      return 'ts';
    case 'java':
      return 'java';
    case 'cpp':
      return 'cpp';
    case 'c':
      return 'c';
    case 'go':
      return 'go';
    case 'rust':
      return 'rs';
    default:
      return 'txt';
  }
}
