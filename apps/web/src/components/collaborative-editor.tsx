import Editor, { type OnMount } from '@monaco-editor/react';
import { useEffect, useMemo, useRef } from 'react';
import { MonacoBinding } from 'y-monaco';
import type { Awareness } from 'y-protocols/awareness';
import type * as Y from 'yjs';
import { CODE_TEXT_KEY } from '@/lib/yjs-collab-provider.js';
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
  const editorRootRef = useRef<HTMLElement | null>(null);
  const onRunCodeRef = useRef(onRunCode);
  onRunCodeRef.current = onRunCode;
  const onSubmitCodeRef = useRef(onSubmitCode);
  onSubmitCodeRef.current = onSubmitCode;

  const editorOptions = useMemo(() => ({ ...EDITOR_OPTIONS_BASE, readOnly }), [readOnly]);

  const handleMount: OnMount = (editor, monaco) => {
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

    editorRootRef.current = editor.getDomNode();

    const model = editor.getModel();
    if (model == null) return;

    const yText = doc.getText(CODE_TEXT_KEY);
    bindingRef.current = new MonacoBinding(yText, model, new Set([editor]), awareness);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: doc and awareness are intentional deps; when they change the old binding must be destroyed so handleMount creates a fresh one.
  useEffect(() => {
    return () => {
      bindingRef.current?.destroy();
      bindingRef.current = null;
    };
  }, [doc, awareness]);

  useEffect(() => {
    const styleEl = document.createElement('style');
    document.head.appendChild(styleEl);

    const idleIds = new Set<number>();
    const hoverIds = new Set<number>();
    let tickHandle: ReturnType<typeof setInterval> | null = null;

    const getLastUpdated = (clientID: number): number => {
      const meta = awareness.meta.get(clientID);
      return meta?.lastUpdated ?? Date.now();
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

    const remoteCursorSelector = (event: Event): HTMLElement | null => {
      const target = event.target as HTMLElement | null;
      if (!target) return null;
      const headClass = Array.from(target.classList ?? []).find((c) =>
        c.startsWith('yRemoteSelectionHead-'),
      );
      if (headClass) return target;
      return target.closest('[class*="yRemoteSelectionHead-"]');
    };

    const clientIdFromElement = (el: HTMLElement): number | null => {
      const headClass = Array.from(el.classList).find((c) => c.startsWith('yRemoteSelectionHead-'));
      if (!headClass) return null;
      const id = Number.parseInt(headClass.slice('yRemoteSelectionHead-'.length), 10);
      return Number.isFinite(id) ? id : null;
    };

    const onMouseOver = (event: Event) => {
      const el = remoteCursorSelector(event);
      if (!el) return;
      const id = clientIdFromElement(el);
      if (id == null || id === doc.clientID) return;
      if (!hoverIds.has(id)) {
        hoverIds.add(id);
        updateStyles();
      }
    };

    const onMouseOut = (event: Event) => {
      const el = remoteCursorSelector(event);
      if (!el) return;
      const id = clientIdFromElement(el);
      if (id == null) return;
      if (hoverIds.delete(id)) updateStyles();
    };

    const root = editorRootRef.current ?? document;
    root.addEventListener('mouseover', onMouseOver, true);
    root.addEventListener('mouseout', onMouseOut, true);

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
      root.removeEventListener('mouseover', onMouseOver, true);
      root.removeEventListener('mouseout', onMouseOut, true);
      if (tickHandle != null) clearInterval(tickHandle);
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
