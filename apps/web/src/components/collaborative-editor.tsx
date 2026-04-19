import Editor, { type OnMount } from '@monaco-editor/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MonacoBinding } from 'y-monaco';
import type { Awareness } from 'y-protocols/awareness';
import type * as Y from 'yjs';
import { codeTextKey } from '@/lib/yjs-collab-provider.js';
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
  type EditorInstance = Parameters<OnMount>[0];
  const [editor, setEditor] = useState<EditorInstance | null>(null);
  const onRunCodeRef = useRef(onRunCode);
  onRunCodeRef.current = onRunCode;
  const onSubmitCodeRef = useRef(onSubmitCode);
  onSubmitCodeRef.current = onSubmitCode;

  const editorOptions = useMemo(() => ({ ...EDITOR_OPTIONS_BASE, readOnly }), [readOnly]);

  const handleMount: OnMount = (editorInstance, monaco) => {
    // Register keyboard shortcuts
    editorInstance.addAction({
      id: 'syncode-run',
      label: 'Run Code',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => void onRunCodeRef.current(),
    });

    editorInstance.addAction({
      id: 'syncode-submit',
      label: 'Submit Code',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter],
      run: () => void onSubmitCodeRef.current(),
    });

    setEditor(editorInstance);
  };

  useEffect(() => {
    if (!editor) return;

    const model = editor.getModel();
    if (model == null) return;

    bindingRef.current?.destroy();
    const yText = doc.getText(codeTextKey(language));
    bindingRef.current = new MonacoBinding(yText, model, new Set([editor]), awareness);

    return () => {
      bindingRef.current?.destroy();
      bindingRef.current = null;
    };
  }, [editor, doc, awareness, language]);

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
