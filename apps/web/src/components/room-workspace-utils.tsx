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
  errors: number;
} {
  let passed = 0;
  let total = 0;
  let errors = 0;
  for (const state of results.values()) {
    if (state.status === 'completed' || state.status === 'failed') {
      total++;
      if (state.passed === true) passed++;
    } else if (state.status === 'request-error') {
      total++;
      errors++;
    }
  }
  return { passed, total, errors };
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

type DiffKind = 'same' | 'expected' | 'actual';

function getDiffPrefix(kind: DiffKind): string {
  if (kind === 'same') return '  ';
  if (kind === 'expected') return '- ';
  return '+ ';
}

function getDiffColor(kind: DiffKind): string {
  if (kind === 'same') return 'text-muted-foreground';
  if (kind === 'expected') return 'text-success';
  return 'text-destructive';
}

export function LineDiffBlock({
  expected,
  actual,
}: {
  readonly expected: string | null;
  readonly actual: string | null;
}) {
  const lines = buildLineDiff(expected, actual);

  return (
    <pre className="max-h-40 overflow-auto rounded border border-border bg-background p-2 font-mono text-[11px] leading-relaxed">
      {lines.map((line, i) => {
        const prefix = getDiffPrefix(line.kind);
        const color = getDiffColor(line.kind);

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

  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
  });
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
  });

  const compilerOptions = {
    allowJs: true,
    allowNonTsExtensions: true,
    checkJs: true,
    noEmit: true,
    target: monaco.languages.typescript.ScriptTarget.ES2020,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
  };
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions(compilerOptions);
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions(compilerOptions);
};

export const EDITOR_OPTIONS_BASE = {
  fontSize: 14,
  fontFamily: "'Geist Mono', 'IBM Plex Mono', 'Fira Code', monospace",
  minimap: { enabled: false },
  glyphMargin: true,
  scrollBeyondLastLine: false,
  padding: { top: 12, bottom: 12 },
  lineNumbers: 'on' as const,
  renderLineHighlight: 'line' as const,
  cursorBlinking: 'smooth' as const,
  smoothScrolling: true,
  bracketPairColorization: { enabled: true },
  guides: { indentation: true },
  quickSuggestions: { other: true, comments: true, strings: true },
  suggestOnTriggerCharacters: true,
  acceptSuggestionOnEnter: 'on' as const,
  tabCompletion: 'on' as const,
  parameterHints: { enabled: true },
  hover: { enabled: true },
  wordBasedSuggestions: 'matchingDocuments' as const,
  suggestSelection: 'first' as const,
  tabSize: 2,
  wordWrap: 'off' as const,
  automaticLayout: true,
  // Force Monaco's legacy <textarea class="inputarea"> input path instead
  // of the new EditContext API surface (<div class="native-edit-context">),
  // which is enabled by default in Chrome/Edge since Monaco 0.52. The
  // tldraw whiteboard panel — always mounted alongside the editor to
  // preserve canvas state across tab switches — registers a *document*-
  // level keydown listener (tldraw's OverflowingToolbar) that maps digit
  // keys 1-0 to toolbar tool positions (8 → Insert Media). Its only "bail
  // out while the user is typing" check is tldraw's
  // activeElementShouldCaptureKeys, which recognizes only
  // <input>/<textarea>/contenteditable. Monaco's EditContext <div> matches
  // none of those, so without this option tldraw swallows every digit
  // (preventing them from reaching the editor) and opens its file picker
  // on 8. Falling back to the textarea path satisfies the
  // tagName === "textarea" check, so tldraw correctly stays out of the way
  // while the user types in the code editor.
  editContext: false,
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
