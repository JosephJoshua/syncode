import Editor from '@monaco-editor/react';
import { Play, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../components/ui/Button';

// ─── Types ──────────────────────────────────────────────────────────────────

type Stage = 'waiting' | 'warmup' | 'coding' | 'wrapup' | 'finished';

interface CodeEditorPanelProps {
  stage?: Stage;
  spectatorMode?: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const LANGUAGES = ['javascript', 'python', 'typescript', 'java', 'cpp'] as const;

const LANGUAGE_LABELS: Record<string, string> = {
  javascript: 'JavaScript',
  python: 'Python',
  typescript: 'TypeScript',
  java: 'Java',
  cpp: 'C++',
};

const MOCK_CODE = `function twoSum(nums, target) {
  const map = new Map();

  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];

    if (map.has(complement)) {
      return [map.get(complement), i];
    }

    map.set(nums[i], i);
  }

  return [];
}

// Example usage
const nums = [2, 7, 11, 15];
const target = 9;
console.log(twoSum(nums, target)); // [0, 1]`;

const WARMUP_CODE = '// Start coding when the coding stage begins';

// ─── Collaborative Cursors (visual mock) ─────────────────────────────────────

function CollaborativeCursors() {
  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Bob Park — cursor at approx line 7, char 24 */}
      <div className="absolute" style={{ top: 120, left: 260 }}>
        <div
          className="font-mono text-[10px] text-white px-1.5 py-0.5 rounded-sm mb-0.5 whitespace-nowrap"
          style={{ backgroundColor: '#10b981' }}
        >
          Bob Park
        </div>
        <div className="w-0.5 rounded-full" style={{ height: 18, backgroundColor: '#10b981' }} />
      </div>

      {/* Carol Wu — cursor at approx line 12, char 16, with selection highlight */}
      <div className="absolute" style={{ top: 204, left: 190 }}>
        <div
          className="font-mono text-[10px] text-white px-1.5 py-0.5 rounded-sm mb-0.5 whitespace-nowrap"
          style={{ backgroundColor: '#f59e0b' }}
        >
          Carol Wu
        </div>
        <div className="w-0.5 rounded-full" style={{ height: 18, backgroundColor: '#f59e0b' }} />
        {/* Selection highlight */}
        <div
          className="absolute rounded-sm"
          style={{
            top: 24,
            left: 0,
            width: 120,
            height: 18,
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
          }}
        />
      </div>
    </div>
  );
}

// ─── Code Editor Panel ───────────────────────────────────────────────────────

export function CodeEditorPanel({ stage = 'coding', spectatorMode = false }: CodeEditorPanelProps) {
  const [language, setLanguage] = useState('javascript');

  const buttonsDisabled =
    stage === 'warmup' || stage === 'wrapup' || stage === 'finished' || stage === 'waiting';
  const isReadOnly = spectatorMode || stage === 'warmup' || stage === 'waiting';

  const editorValue = stage === 'warmup' || stage === 'waiting' ? WARMUP_CODE : MOCK_CODE;

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Editor Header */}
      <div className="h-8 flex items-center px-3 border-b border-[var(--border-default)] bg-[var(--bg-raised)] flex-none">
        {/* Left: Language selector */}
        <div className="relative">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="appearance-none font-mono text-xs text-[var(--text-primary)] bg-transparent border border-[var(--border-default)] rounded px-2 py-0.5 pr-6 cursor-pointer hover:bg-[var(--bg-subtle)] focus:outline-none focus:border-[var(--border-strong)] transition-colors"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {LANGUAGE_LABELS[lang]}
              </option>
            ))}
          </select>
          <svg
            className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>

        {/* Right: Actions */}
        <div className="ml-auto flex items-center gap-1.5">
          {!spectatorMode && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className={`text-xs gap-1 px-2 ${buttonsDisabled ? 'opacity-40 pointer-events-none' : ''}`}
              >
                <RotateCcw size={14} />
                Reset
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className={`text-xs gap-1 px-2 ${buttonsDisabled ? 'opacity-40 pointer-events-none' : ''}`}
              >
                <Play size={14} />
                Run
              </Button>
              <Button
                variant="primary"
                size="sm"
                className={`text-xs px-2 ${buttonsDisabled ? 'opacity-40 pointer-events-none' : ''}`}
              >
                Submit
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 min-h-0 relative">
        <CollaborativeCursors />
        <Editor
          height="100%"
          language={language}
          value={editorValue}
          theme="syncode-dark"
          loading={
            <div className="flex-1 w-full h-full bg-[var(--bg-subtle)] p-4">
              <div className="space-y-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-4 rounded animate-pulse"
                    style={{
                      width: `${40 + ((i * 17) % 50)}%`,
                      backgroundColor: 'var(--border-default)',
                      opacity: 0.3,
                    }}
                  />
                ))}
              </div>
            </div>
          }
          options={{
            fontSize: 14,
            fontFamily: "'IBM Plex Mono', monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            renderLineHighlight: 'line',
            cursorBlinking: 'smooth',
            padding: { top: 12 },
            wordWrap: 'off',
            readOnly: isReadOnly,
          }}
          beforeMount={(monaco) => {
            monaco.editor.defineTheme('syncode-dark', {
              base: 'vs-dark',
              inherit: true,
              rules: [
                { token: 'comment', foreground: '71717a', fontStyle: 'italic' },
                { token: 'keyword', foreground: '00e599' },
                { token: 'string', foreground: 'f59e0b' },
                { token: 'number', foreground: '06b6d4' },
                { token: 'type', foreground: '818cf8' },
                { token: 'function', foreground: 'fafafa' },
              ],
              colors: {
                'editor.background': '#0f0f12',
                'editor.foreground': '#fafafa',
                'editor.lineHighlightBackground': '#1c1c2040',
                'editorLineNumber.foreground': '#3f3f46',
                'editorLineNumber.activeForeground': '#71717a',
                'editor.selectionBackground': '#00e59920',
                'editorCursor.foreground': '#00e599',
                'editor.inactiveSelectionBackground': '#00e59910',
              },
            });
          }}
        />
      </div>
    </div>
  );
}
