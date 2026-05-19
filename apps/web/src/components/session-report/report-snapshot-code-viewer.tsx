import type { SupportedLanguage } from '@syncode/shared';
import { Suspense } from 'react';
import { LazyMonacoEditor as Editor } from '@/components/lazy-monaco-editor.js';
import {
  EDITOR_LOADING,
  EDITOR_OPTIONS_BASE,
  handleEditorWillMount,
  toMonacoLanguage,
} from '@/components/room-workspace-utils.js';

const MIN_EDITOR_HEIGHT_PX = 180;
const MAX_EDITOR_HEIGHT_PX = 360;
const LINE_HEIGHT_PX = 22;
const VERTICAL_PADDING_PX = 28;

export function ReportSnapshotCodeViewer({
  code,
  language,
  linesOfCode,
  compact = false,
}: {
  code: string;
  language: SupportedLanguage;
  linesOfCode: number;
  compact?: boolean;
}) {
  const minHeight = compact ? 92 : MIN_EDITOR_HEIGHT_PX;
  const maxHeight = compact ? 220 : MAX_EDITOR_HEIGHT_PX;
  const editorHeight = Math.min(
    maxHeight,
    Math.max(minHeight, linesOfCode * LINE_HEIGHT_PX + VERTICAL_PADDING_PX),
  );

  return (
    <div
      className={`${compact ? 'mt-3' : 'mt-4'} overflow-hidden rounded-xl border border-border/50 bg-background/70`}
    >
      <Suspense fallback={EDITOR_LOADING}>
        <Editor
          height={`${editorHeight}px`}
          language={toMonacoLanguage(language)}
          value={code}
          theme="syncode-dark"
          beforeMount={handleEditorWillMount}
          options={{
            ...EDITOR_OPTIONS_BASE,
            readOnly: true,
            domReadOnly: true,
            minimap: { enabled: false },
            lineNumbersMinChars: 3,
            scrollbar: {
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
            },
            overviewRulerBorder: false,
            overviewRulerLanes: 0,
            contextmenu: false,
            renderValidationDecorations: 'off',
          }}
          loading={EDITOR_LOADING}
        />
      </Suspense>
    </div>
  );
}
