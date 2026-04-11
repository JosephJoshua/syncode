import type { BeforeMount } from '@monaco-editor/react';
import { Loader2, TerminalSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type RunState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'queued' | 'running'; jobId: string }
  | {
      status: 'completed' | 'failed';
      jobId: string;
      stdout: string;
      stderr: string;
      exitCode: number;
      durationMs: number;
      error?: string;
    }
  | { status: 'request-error'; message: string };

export const EXECUTION_POLL_INTERVAL_MS = 1_200;

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

export function ExecutionOutput({ runState }: { runState: RunState }) {
  const { t } = useTranslation('rooms');

  if (runState.status === 'idle') {
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

  if (runState.status === 'submitting' || runState.status === 'queued') {
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">
          {t('workspace.executionQueued')}
        </span>
        <span className="terminal-cursor" />
      </div>
    );
  }

  if (runState.status === 'running') {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="size-3 animate-spin text-primary" />
        <span className="font-mono text-xs text-primary/80">{t('workspace.executionRunning')}</span>
        <span className="terminal-cursor" />
      </div>
    );
  }

  if (runState.status === 'request-error') {
    return <p className="font-mono text-xs text-destructive">{runState.message}</p>;
  }

  if (runState.status !== 'completed' && runState.status !== 'failed') {
    return <p className="font-mono text-xs text-muted-foreground/60">{t('workspace.noOutput')}</p>;
  }

  return (
    <div className="space-y-2">
      {runState.stdout ? (
        <pre className="max-h-32 overflow-auto rounded border border-border bg-card p-2.5 font-mono text-xs text-foreground/90">
          {runState.stdout}
        </pre>
      ) : null}
      {runState.stderr || runState.error ? (
        <pre className="max-h-24 overflow-auto rounded border border-destructive/20 bg-destructive/5 p-2.5 font-mono text-xs text-destructive">
          {runState.stderr || runState.error}
        </pre>
      ) : null}
      {!runState.stdout && !runState.stderr && !runState.error ? (
        <p className="font-mono text-xs text-muted-foreground/60">{t('workspace.emptyStdout')}</p>
      ) : null}
    </div>
  );
}
