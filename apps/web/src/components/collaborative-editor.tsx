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

  // Inject dynamic CSS for remote cursor colors from awareness state.
  useEffect(() => {
    const styleEl = document.createElement('style');
    document.head.appendChild(styleEl);

    const updateStyles = () => {
      const rules: string[] = [];
      awareness.getStates().forEach((state, clientID) => {
        if (clientID === doc.clientID) return;
        const user = state.user as
          | { name?: string; color?: string; colorLight?: string }
          | undefined;
        if (!user?.color) return;
        const light = user.colorLight ?? `${user.color}33`;
        const name = (user.name ?? '').replace(/[\\"]/g, '');

        rules.push(
          `.yRemoteSelection-${clientID} { background-color: ${light}; }`,
          `.yRemoteSelectionHead-${clientID} { position: relative; border-left: 2px solid ${user.color}; }`,
          `.yRemoteSelectionHead-${clientID}::after {
            position: absolute;
            content: "${name}";
            background-color: ${user.color};
            color: #fff;
            font-size: 10px;
            font-family: sans-serif;
            padding: 0 3px;
            border-radius: 2px 2px 2px 0;
            line-height: 16px;
            white-space: nowrap;
            top: 0;
            left: -2px;
            pointer-events: none;
            z-index: 10;
          }`,
        );
      });
      styleEl.textContent = rules.join('\n');
    };

    const onAwarenessChange = ({
      added,
      removed,
    }: {
      added: number[];
      updated: number[];
      removed: number[];
    }) => {
      if (added.length > 0 || removed.length > 0) updateStyles();
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
