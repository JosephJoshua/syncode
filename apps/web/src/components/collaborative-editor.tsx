import Editor, { type OnMount } from '@monaco-editor/react';
import { useEffect, useMemo, useRef } from 'react';
import { MonacoBinding } from 'y-monaco';
import type { Awareness } from 'y-protocols/awareness';
import type * as Y from 'yjs';
import { CODE_TEXT_KEY } from '@/lib/yjs-collab-provider.js';
import { buildCursorCssRules } from './cursor-styles.js';
import {
  EDITOR_LOADING,
  EDITOR_OPTIONS_BASE,
  handleEditorWillMount,
} from './room-workspace-utils.js';

interface CollaborativeEditorProps {
  doc: Y.Doc;
  awareness: Awareness;
  language: string;
  readOnly: boolean;
  commentLineNumbers: number[];
  activeCommentLine: number | null;
  onRunCode: () => void;
  onSubmitCode: () => void;
  onActiveLineChange: (lineNumber: number) => void;
}

interface EditorLike {
  addAction: (action: {
    id: string;
    label: string;
    keybindings: number[];
    run: () => void;
  }) => void;
  getModel: () => object | null;
  getPosition: () => { lineNumber: number } | null;
  onDidChangeCursorPosition: (listener: (event: { position: { lineNumber: number } }) => void) =>
    void;
  deltaDecorations: (
    oldDecorations: string[],
    newDecorations: Array<{
      range: {
        startLineNumber: number;
        startColumn: number;
        endLineNumber: number;
        endColumn: number;
      };
      options: Record<string, unknown>;
    }>,
  ) => string[];
}

interface MonacoLike {
  KeyMod: {
    CtrlCmd: number;
    Shift: number;
  };
  KeyCode: {
    Enter: number;
  };
}

export function CollaborativeEditor({
  doc,
  awareness,
  language,
  readOnly,
  commentLineNumbers,
  activeCommentLine,
  onRunCode,
  onSubmitCode,
  onActiveLineChange,
}: CollaborativeEditorProps) {
  const bindingRef = useRef<MonacoBinding | null>(null);
  const editorRef = useRef<EditorLike | null>(null);
  const decorationIdsRef = useRef<string[]>([]);
  const onRunCodeRef = useRef(onRunCode);
  onRunCodeRef.current = onRunCode;
  const onSubmitCodeRef = useRef(onSubmitCode);
  onSubmitCodeRef.current = onSubmitCode;
  const onActiveLineChangeRef = useRef(onActiveLineChange);
  onActiveLineChangeRef.current = onActiveLineChange;

  const editorOptions = useMemo(() => ({ ...EDITOR_OPTIONS_BASE, readOnly }), [readOnly]);

  const handleMount: OnMount = (editor, monaco) => {
    const editorInstance = editor as unknown as EditorLike;
    const monacoApi = monaco as unknown as MonacoLike;
    editorRef.current = editorInstance;

    // Register keyboard shortcuts
    editorInstance.addAction({
      id: 'syncode-run',
      label: 'Run Code',
      keybindings: [monacoApi.KeyMod.CtrlCmd | monacoApi.KeyCode.Enter],
      run: () => void onRunCodeRef.current(),
    });

    editorInstance.addAction({
      id: 'syncode-submit',
      label: 'Submit Code',
      keybindings: [
        monacoApi.KeyMod.CtrlCmd | monacoApi.KeyMod.Shift | monacoApi.KeyCode.Enter,
      ],
      run: () => void onSubmitCodeRef.current(),
    });

    // Bind Monaco model to Y.Text via y-monaco
    const model = editorInstance.getModel();
    if (model == null) return;

    const yText = doc.getText(CODE_TEXT_KEY);
    bindingRef.current = new MonacoBinding(
      yText,
      model as never,
      new Set([editor as never]),
      awareness,
    );

    onActiveLineChangeRef.current(editorInstance.getPosition()?.lineNumber ?? 1);
    editorInstance.onDidChangeCursorPosition((event) => {
      onActiveLineChangeRef.current(event.position.lineNumber);
    });
  };

  // Clean up binding when component unmounts or doc/awareness changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: doc and awareness are intentional deps — when they change the old binding must be destroyed so handleMount can create a fresh one.
  useEffect(() => {
    return () => {
      bindingRef.current?.destroy();
      bindingRef.current = null;
      if (editorRef.current) {
        decorationIdsRef.current = editorRef.current.deltaDecorations(decorationIdsRef.current, []);
      }
      editorRef.current = null;
    };
  }, [doc, awareness]);

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    const uniqueLines = [...new Set(commentLineNumbers)]
      .filter((lineNumber) => Number.isFinite(lineNumber) && lineNumber > 0)
      .sort((left, right) => left - right);

    const decorations = uniqueLines.map((lineNumber) => ({
      range: {
        startLineNumber: lineNumber,
        startColumn: 1,
        endLineNumber: lineNumber,
        endColumn: 1,
      },
      options: {
        isWholeLine: true,
        className:
          lineNumber === activeCommentLine
            ? 'inline-comment-line-active'
            : 'inline-comment-line',
        glyphMarginClassName:
          lineNumber === activeCommentLine
            ? 'inline-comment-glyph-active'
            : 'inline-comment-glyph',
        stickiness: 1,
      },
    }));

    decorationIdsRef.current = editorRef.current.deltaDecorations(
      decorationIdsRef.current,
      decorations,
    );
  }, [activeCommentLine, commentLineNumbers]);

  // Inject dynamic CSS for remote cursor colors from awareness state.
  useEffect(() => {
    const styleEl = document.createElement('style');
    document.head.appendChild(styleEl);

    const updateStyles = () => {
      const rules = buildCursorCssRules(awareness.getStates(), doc.clientID);
      styleEl.textContent = rules.join('\n');
    };

    const onAwarenessChange = ({
      added,
      updated,
      removed,
    }: {
      added: number[];
      updated: number[];
      removed: number[];
    }) => {
      if (added.length > 0 || updated.length > 0 || removed.length > 0) updateStyles();
    };
    awareness.on('change', onAwarenessChange);
    updateStyles();

    return () => {
      awareness.off('change', onAwarenessChange);
      styleEl.remove();
    };
  }, [awareness, doc.clientID]);

  return (
    <Editor
      height="100%"
      language={language}
      theme="syncode-dark"
      beforeMount={handleEditorWillMount}
      onMount={handleMount}
      options={editorOptions}
      loading={EDITOR_LOADING}
    />
  );
}
