import Editor, { type OnMount } from '@monaco-editor/react';
import { useEffect, useMemo, useRef } from 'react';
import { MonacoBinding } from 'y-monaco';
import type { Awareness } from 'y-protocols/awareness';
import type * as Y from 'yjs';
import { CODE_TEXT_KEY } from '@/lib/yjs-collab-provider.js';
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
  onRunCode: () => void;
  onSubmitCode: () => void;
}

export function CollaborativeEditor({
  doc,
  awareness,
  language,
  readOnly,
  onRunCode,
  onSubmitCode,
}: CollaborativeEditorProps) {
  const bindingRef = useRef<MonacoBinding | null>(null);
  const onRunCodeRef = useRef(onRunCode);
  onRunCodeRef.current = onRunCode;
  const onSubmitCodeRef = useRef(onSubmitCode);
  onSubmitCodeRef.current = onSubmitCode;

  const editorOptions = useMemo(() => ({ ...EDITOR_OPTIONS_BASE, readOnly }), [readOnly]);

  const handleMount: OnMount = (editor, monaco) => {
    // Register keyboard shortcuts
    editor.addAction({
      id: 'syncode-run',
      label: 'Run Code',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => void onRunCodeRef.current(),
    });

    editor.addAction({
      id: 'syncode-submit',
      label: 'Submit Code',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter],
      run: () => void onSubmitCodeRef.current(),
    });

    // Bind Monaco model to Y.Text via y-monaco
    const model = editor.getModel();
    if (model == null) return;

    const yText = doc.getText(CODE_TEXT_KEY);
    bindingRef.current = new MonacoBinding(yText, model, new Set([editor]), awareness);
  };

  // Clean up binding when component unmounts or doc/awareness changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: doc and awareness are intentional deps — when they change the old binding must be destroyed so handleMount can create a fresh one.
  useEffect(() => {
    return () => {
      bindingRef.current?.destroy();
      bindingRef.current = null;
    };
  }, [doc, awareness]);

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
