import Editor, { type OnMount } from '@monaco-editor/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MonacoBinding } from 'y-monaco';
import type { Awareness } from 'y-protocols/awareness';
import type * as Y from 'yjs';
import { clientIdFromElement, remoteCursorSelector } from '@/lib/remote-cursor-dom.js';
import { codeTextKey } from '@/lib/yjs-collab-provider.js';
import { buildCursorCssRules, IDLE_HIDE_MS } from './cursor-styles.js';
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
  onDidChangeCursorPosition: (
    listener: (event: { position: { lineNumber: number } }) => void,
  ) => void;
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
  type EditorInstance = Parameters<OnMount>[0];
  const [editor, setEditor] = useState<EditorInstance | null>(null);
  const [editorRoot, setEditorRoot] = useState<HTMLElement | null>(null);
  const decorationIdsRef = useRef<string[]>([]);
  const onRunCodeRef = useRef(onRunCode);
  onRunCodeRef.current = onRunCode;
  const onSubmitCodeRef = useRef(onSubmitCode);
  onSubmitCodeRef.current = onSubmitCode;
  const onActiveLineChangeRef = useRef(onActiveLineChange);
  onActiveLineChangeRef.current = onActiveLineChange;

  const editorOptions = useMemo(() => ({ ...EDITOR_OPTIONS_BASE, readOnly }), [readOnly]);

  const handleMount: OnMount = (editorInstance, monaco) => {
    const monacoApi = monaco as unknown as MonacoLike;

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
      keybindings: [monacoApi.KeyMod.CtrlCmd | monacoApi.KeyMod.Shift | monacoApi.KeyCode.Enter],
      run: () => void onSubmitCodeRef.current(),
    });

    onActiveLineChangeRef.current(editorInstance.getPosition()?.lineNumber ?? 1);
    editorInstance.onDidChangeCursorPosition((event) => {
      onActiveLineChangeRef.current(event.position.lineNumber);
    });

    setEditor(editorInstance);
    setEditorRoot(editorInstance.getDomNode());
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
      decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, []);
    };
  }, [editor, doc, awareness, language]);

  useEffect(() => {
    if (!editor) {
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
          lineNumber === activeCommentLine ? 'inline-comment-line-active' : 'inline-comment-line',
        glyphMarginClassName:
          lineNumber === activeCommentLine ? 'inline-comment-glyph-active' : 'inline-comment-glyph',
        stickiness: 1,
      },
    }));

    decorationIdsRef.current = (editor as unknown as EditorLike).deltaDecorations(
      decorationIdsRef.current,
      decorations,
    );
  }, [editor, activeCommentLine, commentLineNumbers]);

  // Inject dynamic CSS for remote cursor colors from awareness state.
  useEffect(() => {
    if (!editorRoot) return;

    const styleEl = document.createElement('style');
    document.head.appendChild(styleEl);

    const idleIds = new Set<number>();
    const hoverIds = new Set<number>();
    let tickHandle: ReturnType<typeof setInterval> | null = null;

    const getLastUpdated = (clientID: number): number => {
      const meta = awareness.meta.get(clientID);
      // No meta entry yet (cold start or out-of-order update): treat as stale so the
      // cursor fades immediately rather than appearing freshly active forever.
      return meta?.lastUpdated ?? 0;
    };

    const remoteStates = () => {
      const states = awareness.getStates();
      const filtered = new Map<number, Record<string, unknown>>();
      states.forEach((state, id) => {
        if (id !== doc.clientID) filtered.set(id, state);
      });
      return filtered;
    };

    const updateStyles = () => {
      const rules = buildCursorCssRules(awareness.getStates(), doc.clientID, {
        idleClientIds: idleIds,
        transparentClientIds: hoverIds,
      });
      styleEl.textContent = rules.join('\n');
    };

    const findRemoteCursor = (event: Event): Element | null => {
      const target = event.target as Element | null;
      if (!target) return null;
      if (typeof target.closest !== 'function') return null;
      return target.closest(remoteCursorSelector());
    };

    const onMouseOver = (event: Event) => {
      const el = findRemoteCursor(event);
      if (!el) return;
      const id = clientIdFromElement(el);
      if (id == null || id === doc.clientID) return;
      if (!hoverIds.has(id)) {
        hoverIds.add(id);
        updateStyles();
      }
    };

    const onMouseOut = (event: Event) => {
      const el = findRemoteCursor(event);
      if (!el) return;
      const id = clientIdFromElement(el);
      if (id == null) return;
      if (hoverIds.delete(id)) updateStyles();
    };

    editorRoot.addEventListener('mouseover', onMouseOver, true);
    editorRoot.addEventListener('mouseout', onMouseOut, true);

    const recomputeIdle = () => {
      const now = Date.now();
      let changed = false;
      const present = new Set<number>();
      awareness.getStates().forEach((_, id) => {
        if (id === doc.clientID) return;
        present.add(id);
        const stamp = getLastUpdated(id);
        const shouldBeIdle = now - stamp >= IDLE_HIDE_MS;
        if (shouldBeIdle && !idleIds.has(id)) {
          idleIds.add(id);
          // Hidden cursors can't receive mouseout, so drop any stale hover
          // mark to avoid them reappearing transparent on the next update.
          hoverIds.delete(id);
          changed = true;
        } else if (!shouldBeIdle && idleIds.has(id)) {
          idleIds.delete(id);
          changed = true;
        }
      });
      idleIds.forEach((id) => {
        if (!present.has(id)) {
          idleIds.delete(id);
          changed = true;
        }
      });
      if (changed) updateStyles();
    };

    const ensureTicking = () => {
      const hasRemote = remoteStates().size > 0;
      if (hasRemote && tickHandle == null) {
        tickHandle = setInterval(recomputeIdle, 1_000);
      } else if (!hasRemote && tickHandle != null) {
        clearInterval(tickHandle);
        tickHandle = null;
      }
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
      if (added.length === 0 && updated.length === 0 && removed.length === 0) return;
      for (const id of [...added, ...updated]) {
        if (id === doc.clientID) continue;
        idleIds.delete(id);
      }
      for (const id of removed) {
        idleIds.delete(id);
        hoverIds.delete(id);
      }
      updateStyles();
      ensureTicking();
    };

    awareness.on('change', onAwarenessChange);
    updateStyles();
    ensureTicking();

    return () => {
      awareness.off('change', onAwarenessChange);
      editorRoot.removeEventListener('mouseover', onMouseOver, true);
      editorRoot.removeEventListener('mouseout', onMouseOut, true);
      if (tickHandle != null) clearInterval(tickHandle);
      styleEl.remove();
    };
  }, [awareness, doc.clientID, editorRoot]);

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
