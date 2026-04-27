import Editor, { type OnMount } from '@monaco-editor/react';
import { cn } from '@syncode/ui';
import { MessageCircle, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MonacoBinding } from 'y-monaco';
import type { Awareness } from 'y-protocols/awareness';
import type * as Y from 'yjs';
import type { InlineComment } from '@/lib/inline-comments.js';
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
  comments?: InlineComment[];
  commentLineNumbers?: number[];
  canAddComments?: boolean;
  onAddComment?: (lineNumber: number, content: string) => void;
  onRunCode: () => void;
  onSubmitCode: () => void;
}

interface DisposableLike {
  dispose: () => void;
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
  getDomNode: () => HTMLElement | null;
  focus: () => void;
  onDidChangeCursorPosition: (
    listener: (event: { position: { lineNumber: number } }) => void,
  ) => DisposableLike;
  onDidScrollChange: (listener: () => void) => DisposableLike;
  onDidLayoutChange: (listener: () => void) => DisposableLike;
  onDidChangeModelContent: (listener: () => void) => DisposableLike;
  onMouseDown: (listener: (event: EditorMouseEventLike) => void) => DisposableLike;
  getVisibleRanges: () => Array<{ startLineNumber: number; endLineNumber: number }>;
  getLayoutInfo: () => {
    glyphMarginLeft: number;
    glyphMarginWidth: number;
    contentLeft: number;
  };
  getScrolledVisiblePosition: (position: {
    lineNumber: number;
    column: number;
  }) => { top: number; left: number; height: number } | null;
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

interface EditorMouseEventLike {
  target: {
    type: number;
    position?: {
      lineNumber: number;
    } | null;
  };
}

interface MonacoLike {
  KeyMod: {
    CtrlCmd: number;
    Shift: number;
  };
  KeyCode: {
    Enter: number;
  };
  editor: {
    MouseTargetType: {
      GUTTER_GLYPH_MARGIN: number;
    };
  };
}

export function CollaborativeEditor({
  doc,
  awareness,
  language,
  readOnly,
  comments = [],
  commentLineNumbers = [],
  canAddComments = false,
  onAddComment = () => {},
  onRunCode,
  onSubmitCode,
}: CollaborativeEditorProps) {
  const { t } = useTranslation('rooms');
  const bindingRef = useRef<MonacoBinding | null>(null);
  type EditorInstance = Parameters<OnMount>[0];
  const [editor, setEditor] = useState<EditorInstance | null>(null);
  const [editorRoot, setEditorRoot] = useState<HTMLElement | null>(null);
  const [selectedLine, setSelectedLine] = useState(1);
  const [composerLine, setComposerLine] = useState<number | null>(null);
  const [composerDraft, setComposerDraft] = useState('');
  const [threadLine, setThreadLine] = useState<number | null>(null);
  const [overlayVersion, setOverlayVersion] = useState(0);

  const monacoRef = useRef<MonacoLike | null>(null);
  const decorationIdsRef = useRef<string[]>([]);
  const onRunCodeRef = useRef(onRunCode);
  onRunCodeRef.current = onRunCode;
  const onSubmitCodeRef = useRef(onSubmitCode);
  onSubmitCodeRef.current = onSubmitCode;
  const onAddCommentRef = useRef(onAddComment);
  onAddCommentRef.current = onAddComment;

  const editorOptions = useMemo(() => ({ ...EDITOR_OPTIONS_BASE, readOnly }), [readOnly]);

  const commentsByLine = useMemo(() => {
    const map = new Map<number, InlineComment[]>();
    for (const comment of comments) {
      const list = map.get(comment.lineNumber) ?? [];
      list.push(comment);
      map.set(comment.lineNumber, list);
    }
    return map;
  }, [comments]);

  const commentLineSet = useMemo(
    () =>
      new Set(
        commentLineNumbers
          .filter((lineNumber) => Number.isFinite(lineNumber) && lineNumber > 0)
          .map((lineNumber) => Math.floor(lineNumber)),
      ),
    [commentLineNumbers],
  );

  useEffect(() => {
    if (threadLine == null) {
      return;
    }

    if (!commentLineSet.has(threadLine)) {
      setThreadLine(null);
    }
  }, [threadLine, commentLineSet]);

  const handleMount: OnMount = (editorInstance, monaco) => {
    const monacoApi = monaco as unknown as MonacoLike;
    const editorApi = editorInstance as unknown as EditorLike;
    monacoRef.current = monacoApi;

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

    setSelectedLine(editorApi.getPosition()?.lineNumber ?? 1);
    setEditor(editorInstance);
    setEditorRoot(editorApi.getDomNode());
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

  useEffect(() => {
    if (!editor || !monacoRef.current) {
      return;
    }

    const editorApi = editor as unknown as EditorLike;
    const mouseTargetType = monacoRef.current.editor.MouseTargetType;

    const cursorDisposable = editorApi.onDidChangeCursorPosition((event) => {
      setSelectedLine(event.position.lineNumber);
    });

    const mouseDisposable = editorApi.onMouseDown((event) => {
      const lineNumber = event.target.position?.lineNumber;
      if (!lineNumber) {
        return;
      }

      setSelectedLine(lineNumber);

      if (
        event.target.type === mouseTargetType.GUTTER_GLYPH_MARGIN &&
        commentLineSet.has(lineNumber)
      ) {
        setComposerLine(null);
        setComposerDraft('');
        setThreadLine((previous) => (previous === lineNumber ? null : lineNumber));
      }
    });

    return () => {
      cursorDisposable.dispose();
      mouseDisposable.dispose();
    };
  }, [editor, commentLineSet]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const uniqueLines = [...commentLineSet].sort((left, right) => left - right);

    const decorations = uniqueLines.map((lineNumber) => {
      const isThreadOpen = lineNumber === threadLine;
      const isActive = isThreadOpen || lineNumber === selectedLine;

      return {
        range: {
          startLineNumber: lineNumber,
          startColumn: 1,
          endLineNumber: lineNumber,
          endColumn: 1,
        },
        options: {
          isWholeLine: true,
          className: isActive ? 'inline-comment-line-active' : 'inline-comment-line',
          glyphMarginClassName: isThreadOpen
            ? 'inline-comment-glyph-expanded'
            : 'inline-comment-glyph-collapsed',
          stickiness: 1,
        },
      };
    });

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      decorationIdsRef.current = (editor as unknown as EditorLike).deltaDecorations(
        decorationIdsRef.current,
        decorations,
      );
    });

    return () => {
      cancelled = true;
    };
  }, [editor, commentLineSet, selectedLine, threadLine]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const editorApi = editor as unknown as EditorLike;
    const bumpOverlay = () => {
      setOverlayVersion((previous) => previous + 1);
    };

    const scrollDisposable = editorApi.onDidScrollChange(bumpOverlay);
    const layoutDisposable = editorApi.onDidLayoutChange(bumpOverlay);
    const modelDisposable = editorApi.onDidChangeModelContent(bumpOverlay);

    return () => {
      scrollDisposable.dispose();
      layoutDisposable.dispose();
      modelDisposable.dispose();
    };
  }, [editor]);

  const selectedLineOverlay = useMemo(() => {
    void overlayVersion;
    if (!editor || selectedLine < 1) {
      return null;
    }

    const editorApi = editor as unknown as EditorLike;
    const visibleRanges = editorApi.getVisibleRanges();
    const isVisible = visibleRanges.some(
      (range) => selectedLine >= range.startLineNumber && selectedLine <= range.endLineNumber,
    );
    if (!isVisible) {
      return null;
    }

    const linePosition = editorApi.getScrolledVisiblePosition({
      lineNumber: selectedLine,
      column: 1,
    });
    if (!linePosition) {
      return null;
    }

    const layout = editorApi.getLayoutInfo();
    return {
      top: linePosition.top,
      height: linePosition.height,
      glyphLeft: layout.glyphMarginLeft + Math.max((layout.glyphMarginWidth - 16) / 2, 0),
      contentLeft: layout.contentLeft + 8,
    };
  }, [editor, selectedLine, overlayVersion]);

  const commentGlyphOverlays = useMemo(() => {
    void overlayVersion;
    if (!editor || commentLineSet.size === 0) {
      return [];
    }

    const editorApi = editor as unknown as EditorLike;
    const visibleRanges = editorApi.getVisibleRanges();
    const layout = editorApi.getLayoutInfo();
    const glyphLeft = layout.glyphMarginLeft + Math.max((layout.glyphMarginWidth - 14) / 2, 0);

    const overlays: Array<{
      lineNumber: number;
      top: number;
      left: number;
      isExpanded: boolean;
    }> = [];

    for (const lineNumber of [...commentLineSet].sort((left, right) => left - right)) {
      const isVisible = visibleRanges.some(
        (range) => lineNumber >= range.startLineNumber && lineNumber <= range.endLineNumber,
      );
      if (!isVisible) {
        continue;
      }

      const linePosition = editorApi.getScrolledVisiblePosition({
        lineNumber,
        column: 1,
      });
      if (!linePosition) {
        continue;
      }

      overlays.push({
        lineNumber,
        top: linePosition.top + Math.max(linePosition.height / 2 - 7, 0),
        left: glyphLeft,
        isExpanded: lineNumber === threadLine,
      });
    }

    return overlays;
  }, [editor, commentLineSet, threadLine, overlayVersion]);

  const composerOverlay = useMemo(() => {
    void overlayVersion;
    if (!editor || composerLine == null || composerLine < 1) {
      return null;
    }

    const editorApi = editor as unknown as EditorLike;
    const visibleRanges = editorApi.getVisibleRanges();
    const isVisible = visibleRanges.some(
      (range) => composerLine >= range.startLineNumber && composerLine <= range.endLineNumber,
    );
    if (!isVisible) {
      return null;
    }

    const linePosition = editorApi.getScrolledVisiblePosition({
      lineNumber: composerLine,
      column: 1,
    });
    if (!linePosition) {
      return null;
    }

    const layout = editorApi.getLayoutInfo();
    return {
      top: linePosition.top,
      height: linePosition.height,
      left: layout.contentLeft + 8,
      lineNumber: composerLine,
    };
  }, [editor, composerLine, overlayVersion]);

  const threadComments = threadLine == null ? [] : (commentsByLine.get(threadLine) ?? []);

  const threadOverlay = useMemo(() => {
    void overlayVersion;
    if (!editor || threadLine == null || threadLine < 1) {
      return null;
    }

    const editorApi = editor as unknown as EditorLike;
    const visibleRanges = editorApi.getVisibleRanges();
    const isVisible = visibleRanges.some(
      (range) => threadLine >= range.startLineNumber && threadLine <= range.endLineNumber,
    );
    if (!isVisible) {
      return null;
    }

    const linePosition = editorApi.getScrolledVisiblePosition({
      lineNumber: threadLine,
      column: 1,
    });
    if (!linePosition) {
      return null;
    }

    const layout = editorApi.getLayoutInfo();
    return {
      top: linePosition.top,
      height: linePosition.height,
      left: layout.contentLeft + 8,
      lineNumber: threadLine,
    };
  }, [editor, threadLine, overlayVersion]);

  const submitComment = () => {
    if (!canAddComments || composerLine == null) {
      return;
    }

    const normalized = composerDraft.trim();
    if (!normalized) {
      return;
    }

    onAddCommentRef.current(composerLine, normalized);
    setComposerDraft('');
    setComposerLine(null);
    setThreadLine(composerLine);
  };

  const formatTime = (isoTimestamp: string): string => {
    const timestamp = new Date(isoTimestamp);
    if (Number.isNaN(timestamp.getTime())) {
      return '--:--';
    }

    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(timestamp);
  };

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
