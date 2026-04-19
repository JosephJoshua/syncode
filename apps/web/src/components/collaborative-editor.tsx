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

  useEffect(() => {
    const styleEl = document.createElement('style');
    document.head.appendChild(styleEl);

    const lastUpdated = new Map<number, number>();
    const idleIds = new Set<number>();
    const hoverIds = new Set<number>();
    const hoverListeners = new Map<number, { over: () => void; leave: () => void }>();
    let tickHandle: ReturnType<typeof setInterval> | null = null;

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

    const detachHoverFor = (clientID: number) => {
      const existing = hoverListeners.get(clientID);
      if (!existing) return;
      document.querySelectorAll<HTMLElement>(`.yRemoteSelectionHead-${clientID}`).forEach((el) => {
        el.removeEventListener('mouseover', existing.over);
        el.removeEventListener('mouseleave', existing.leave);
      });
      hoverListeners.delete(clientID);
      hoverIds.delete(clientID);
    };

    const attachHoverFor = (clientID: number) => {
      if (hoverListeners.has(clientID)) return;
      const over = () => {
        if (!hoverIds.has(clientID)) {
          hoverIds.add(clientID);
          updateStyles();
        }
      };
      const leave = () => {
        if (hoverIds.delete(clientID)) updateStyles();
      };
      hoverListeners.set(clientID, { over, leave });
      document.querySelectorAll<HTMLElement>(`.yRemoteSelectionHead-${clientID}`).forEach((el) => {
        el.addEventListener('mouseover', over);
        el.addEventListener('mouseleave', leave);
      });
    };

    // Hover targets are rendered by Monaco asynchronously, so re-bind shortly after each awareness change.
    const scheduleHoverRebind = (clientIds: number[]) => {
      requestAnimationFrame(() => {
        clientIds.forEach((id) => {
          if (id === doc.clientID) return;
          const existing = hoverListeners.get(id);
          if (existing) {
            detachHoverFor(id);
          }
          attachHoverFor(id);
        });
      });
    };

    const recomputeIdle = () => {
      const now = Date.now();
      let changed = false;
      const present = new Set<number>();
      awareness.getStates().forEach((_, id) => {
        if (id === doc.clientID) return;
        present.add(id);
        const stamp = lastUpdated.get(id) ?? now;
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
      const now = Date.now();
      for (const id of [...added, ...updated]) {
        if (id === doc.clientID) continue;
        lastUpdated.set(id, now);
        idleIds.delete(id);
      }
      for (const id of removed) {
        lastUpdated.delete(id);
        detachHoverFor(id);
        idleIds.delete(id);
      }
      updateStyles();
      scheduleHoverRebind([...added, ...updated]);
      ensureTicking();
    };

    awareness.on('change', onAwarenessChange);
    // Seed timestamps for any peers already present at mount.
    const now = Date.now();
    awareness.getStates().forEach((_, id) => {
      if (id !== doc.clientID) lastUpdated.set(id, now);
    });
    updateStyles();
    scheduleHoverRebind([...lastUpdated.keys()]);
    ensureTicking();

    return () => {
      awareness.off('change', onAwarenessChange);
      if (tickHandle != null) clearInterval(tickHandle);
      hoverListeners.forEach((_, id) => {
        detachHoverFor(id);
      });
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
