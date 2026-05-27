import type { OnMount } from '@monaco-editor/react';
import { cn } from '@syncode/ui';
import { MessageCircle, Plus, X } from 'lucide-react';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MonacoBinding } from 'y-monaco';
import type { Awareness } from 'y-protocols/awareness';
import type * as Y from 'yjs';
import type { InlineComment } from '@/lib/inline-comments.js';
import { clientIdFromElement, remoteCursorSelector } from '@/lib/remote-cursor-dom.js';
import { codeTextKey } from '@/lib/yjs-collab-provider.js';
import { buildCursorCssRules, IDLE_HIDE_MS } from './cursor-styles.js';
import { InlineCommentMarkdown } from './inline-comment-markdown.js';
import { LazyMonacoEditor as Editor } from './lazy-monaco-editor.js';
import {
  EDITOR_LOADING,
  EDITOR_OPTIONS_BASE,
  handleEditorWillMount,
} from './room-workspace-utils.js';

const INLINE_COMMENT_PANEL_GAP_PX = 6;
const COMMENT_COMPOSER_HEIGHT_ESTIMATE_PX = 160;
const COMMENT_THREAD_HEIGHT_ESTIMATE_PX = 300;

export interface EditorCodeContext {
  codeSnippet: string;
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
  cursorLine?: number;
  cursorColumn?: number;
}

interface CollaborativeEditorProps {
  readonly doc: Y.Doc;
  readonly awareness: Awareness;
  readonly language: string;
  readonly readOnly: boolean;
  readonly comments?: InlineComment[];
  readonly commentLineNumbers?: number[];
  readonly canAddComments?: boolean;
  readonly onAddComment?: (lineNumber: number, content: string) => void;
  readonly onRunCode: () => void;
  readonly onSubmitCode: () => void;
  readonly onActiveLineChange?: (lineNumber: number) => void;
  readonly onCodeContextChange?: (context: EditorCodeContext) => void;
  readonly onFocusChange?: (isFocused: boolean) => void;
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
  getModel: () => ModelLike | null;
  getPosition: () => { lineNumber: number } | null;
  getSelection: () => EditorRangeLike | null;
  getDomNode: () => HTMLElement | null;
  focus: () => void;
  onDidChangeCursorPosition: (
    listener: (event: { position: { lineNumber: number } }) => void,
  ) => DisposableLike;
  onDidChangeCursorSelection: (listener: () => void) => DisposableLike;
  onDidScrollChange: (listener: () => void) => DisposableLike;
  onDidLayoutChange: (listener: () => void) => DisposableLike;
  onDidChangeModelContent: (listener: () => void) => DisposableLike;
  onDidFocusEditorWidget: (listener: () => void) => DisposableLike;
  onDidBlurEditorWidget: (listener: () => void) => DisposableLike;
  onMouseDown: (listener: (event: EditorMouseEventLike) => void) => DisposableLike;
  onMouseMove: (listener: (event: EditorMouseEventLike) => void) => DisposableLike;
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

interface ModelLike {
  getLineCount: () => number;
  getLineContent: (lineNumber: number) => string;
  getValueInRange: (range: EditorRangeLike) => string;
}

interface EditorRangeLike {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  isEmpty?: () => boolean;
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
      GUTTER_LINE_NUMBERS?: number;
      GUTTER_LINE_DECORATIONS?: number;
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
  onActiveLineChange = () => {},
  onCodeContextChange = () => {},
  onFocusChange = () => {},
}: CollaborativeEditorProps) {
  const { t } = useTranslation('rooms');
  const bindingRef = useRef<MonacoBinding | null>(null);
  type EditorInstance = Parameters<OnMount>[0];
  const [editor, setEditor] = useState<EditorInstance | null>(null);
  const [editorRoot, setEditorRoot] = useState<HTMLElement | null>(null);
  const [selectedLine, setSelectedLine] = useState(1);
  const [hoveredGutterLine, setHoveredGutterLine] = useState<number | null>(null);
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
  const onActiveLineChangeRef = useRef(onActiveLineChange);
  onActiveLineChangeRef.current = onActiveLineChange;
  const onCodeContextChangeRef = useRef(onCodeContextChange);
  onCodeContextChangeRef.current = onCodeContextChange;
  const onFocusChangeRef = useRef(onFocusChange);
  onFocusChangeRef.current = onFocusChange;

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

  const emitCodeContext = useCallback(
    (editorApi: EditorLike) => {
      const model = editorApi.getModel();
      if (!model) return;

      const position = editorApi.getPosition();
      const selection = editorApi.getSelection();
      const lineCount = Math.max(1, model.getLineCount());
      const selectionIsEmpty =
        !selection ||
        (typeof selection.isEmpty === 'function'
          ? selection.isEmpty()
          : selection.startLineNumber === selection.endLineNumber &&
            selection.startColumn === selection.endColumn);

      if (selection && !selectionIsEmpty) {
        const startLine = clampLine(selection.startLineNumber, lineCount);
        const endLine = clampLine(selection.endLineNumber, lineCount);
        const selectedSnippet = model.getValueInRange(selection);
        onCodeContextChangeRef.current({
          codeSnippet:
            selectedSnippet.length > 0 ? selectedSnippet : model.getLineContent(startLine),
          startLine,
          endLine,
          startColumn: selection.startColumn,
          endColumn: selection.endColumn,
          cursorLine: position?.lineNumber,
        });
        return;
      }

      const cursorLine = clampLine(position?.lineNumber ?? selectedLine, lineCount);
      const startLine = clampLine(cursorLine - 2, lineCount);
      const endLine = clampLine(cursorLine + 2, lineCount);
      const lines = [];
      for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
        lines.push(model.getLineContent(lineNumber));
      }

      onCodeContextChangeRef.current({
        codeSnippet: lines.join('\n') || model.getLineContent(cursorLine),
        startLine,
        endLine,
        cursorLine,
        cursorColumn: editorApi.getSelection()?.startColumn,
      });
    },
    [selectedLine],
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
      run: () => {
        onRunCodeRef.current();
      },
    });

    editorInstance.addAction({
      id: 'syncode-submit',
      label: 'Submit Code',
      keybindings: [monacoApi.KeyMod.CtrlCmd | monacoApi.KeyMod.Shift | monacoApi.KeyCode.Enter],
      run: () => {
        onSubmitCodeRef.current();
      },
    });

    const initialLine = editorApi.getPosition()?.lineNumber ?? 1;
    setSelectedLine(initialLine);
    onActiveLineChangeRef.current(initialLine);
    emitCodeContext(editorApi);
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
      onActiveLineChangeRef.current(event.position.lineNumber);
      emitCodeContext(editorApi);
    });
    const selectionDisposable = editorApi.onDidChangeCursorSelection(() => {
      emitCodeContext(editorApi);
    });
    const contentDisposable = editorApi.onDidChangeModelContent(() => {
      emitCodeContext(editorApi);
    });
    const focusDisposable = editorApi.onDidFocusEditorWidget(() => {
      onFocusChangeRef.current(true);
    });
    const blurDisposable = editorApi.onDidBlurEditorWidget(() => {
      onFocusChangeRef.current(false);
    });
    const mouseMoveDisposable = editorApi.onMouseMove((event) => {
      const lineNumber = event.target.position?.lineNumber;
      if (lineNumber && isGutterMouseTarget(event.target.type, mouseTargetType)) {
        setHoveredGutterLine(lineNumber);
        return;
      }

      setHoveredGutterLine(null);
    });

    const mouseDisposable = editorApi.onMouseDown((event) => {
      const lineNumber = event.target.position?.lineNumber;
      if (!lineNumber) {
        return;
      }

      setSelectedLine(lineNumber);
      onActiveLineChangeRef.current(lineNumber);

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
      selectionDisposable.dispose();
      contentDisposable.dispose();
      focusDisposable.dispose();
      blurDisposable.dispose();
      mouseMoveDisposable.dispose();
      mouseDisposable.dispose();
    };
  }, [editor, commentLineSet, emitCodeContext]);

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

    const frame = globalThis.window.requestAnimationFrame(() => {
      if (!editor.getModel()) {
        return;
      }

      decorationIdsRef.current = (editor as unknown as EditorLike).deltaDecorations(
        decorationIdsRef.current,
        decorations,
      );
    });

    return () => {
      globalThis.window.cancelAnimationFrame(frame);
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

  const getVisibleLineOverlay = useCallback(
    (lineNumber: number) => {
      void overlayVersion;
      if (!editor || lineNumber < 1) {
        return null;
      }

      const editorApi = editor as unknown as EditorLike;
      const visibleRanges = editorApi.getVisibleRanges();
      const isVisible = visibleRanges.some(
        (range) => lineNumber >= range.startLineNumber && lineNumber <= range.endLineNumber,
      );
      if (!isVisible) {
        return null;
      }

      const linePosition = editorApi.getScrolledVisiblePosition({
        lineNumber,
        column: 1,
      });
      if (!linePosition) {
        return null;
      }

      const layout = editorApi.getLayoutInfo();
      return {
        lineNumber,
        top: linePosition.top,
        height: linePosition.height,
        glyphLeft: layout.glyphMarginLeft + Math.max((layout.glyphMarginWidth - 16) / 2, 0),
      };
    },
    [editor, overlayVersion],
  );

  const addCommentLine = hoveredGutterLine ?? selectedLine;
  const addCommentLineOverlay = useMemo(() => {
    void overlayVersion;
    return getVisibleLineOverlay(addCommentLine);
  }, [addCommentLine, getVisibleLineOverlay, overlayVersion]);

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
    return getVisibleLinePanelOverlay(editorApi, composerLine, COMMENT_COMPOSER_HEIGHT_ESTIMATE_PX);
  }, [editor, composerLine, overlayVersion]);

  const threadComments = threadLine == null ? [] : (commentsByLine.get(threadLine) ?? []);

  const threadOverlay = useMemo(() => {
    void overlayVersion;
    if (!editor || threadLine == null || threadLine < 1) {
      return null;
    }

    const editorApi = editor as unknown as EditorLike;
    return getVisibleLinePanelOverlay(editorApi, threadLine, COMMENT_THREAD_HEIGHT_ESTIMATE_PX);
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
    <div className="relative h-full">
      <Suspense fallback={EDITOR_LOADING}>
        <Editor
          height="100%"
          language={language}
          theme="syncode-dark"
          beforeMount={handleEditorWillMount}
          onMount={handleMount}
          options={editorOptions}
          loading={EDITOR_LOADING}
        />
      </Suspense>

      <div className="pointer-events-none absolute inset-0 z-10">
        {commentGlyphOverlays.map((marker) => (
          <button
            key={marker.lineNumber}
            type="button"
            onClick={() => {
              setSelectedLine(marker.lineNumber);
              setComposerLine(null);
              setComposerDraft('');
              setThreadLine((previous) =>
                previous === marker.lineNumber ? null : marker.lineNumber,
              );
              (editor as unknown as EditorLike | null)?.focus();
            }}
            className={cn(
              'pointer-events-auto absolute grid size-[14px] place-items-center rounded-full border text-[8px] font-bold leading-none shadow-sm transition-all',
              marker.isExpanded
                ? 'border-emerald-300/80 bg-emerald-400/40 text-emerald-100 shadow-emerald-500/30'
                : 'border-emerald-400/55 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30',
            )}
            style={{
              top: marker.top,
              left: marker.left,
            }}
            aria-label={t('workspace.inlineCommentsOnLine', { count: 1, line: marker.lineNumber })}
            title={t('workspace.inlineCommentsOnLine', { count: 1, line: marker.lineNumber })}
          >
            {marker.isExpanded ? '▾' : '▸'}
          </button>
        ))}

        {canAddComments && addCommentLineOverlay ? (
          <button
            type="button"
            onClick={() => {
              setThreadLine(null);
              setSelectedLine(addCommentLineOverlay.lineNumber);
              onActiveLineChangeRef.current(addCommentLineOverlay.lineNumber);
              setComposerLine(addCommentLineOverlay.lineNumber);
              setComposerDraft('');
              (editor as unknown as EditorLike | null)?.focus();
            }}
            className="pointer-events-auto absolute flex size-5 items-center justify-center rounded-full border border-emerald-400/50 bg-background/95 text-emerald-300 shadow-sm shadow-black/40 transition-colors hover:border-emerald-300 hover:bg-emerald-500/15"
            style={{
              top: addCommentLineOverlay.top + Math.max(addCommentLineOverlay.height / 2 - 10, 0),
              left:
                addCommentLineOverlay.glyphLeft +
                (commentLineSet.has(addCommentLineOverlay.lineNumber) ? 18 : 0),
            }}
            aria-label={t('workspace.addComment')}
            title={t('workspace.addComment')}
          >
            <Plus className="size-3" />
          </button>
        ) : null}

        {composerOverlay ? (
          <div
            className="pointer-events-auto absolute w-[min(24rem,calc(100%-1rem))] rounded-lg border border-border bg-card/95 p-2.5 shadow-lg shadow-black/35 backdrop-blur"
            style={{
              ...getLinePanelPositionStyle(composerOverlay),
              left: composerOverlay.left,
            }}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {t('workspace.selectedLine', { line: composerOverlay.lineNumber })}
              </span>
              <button
                type="button"
                onClick={() => {
                  setComposerLine(null);
                  setComposerDraft('');
                }}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                aria-label={t('workspace.cancel')}
                title={t('workspace.cancel')}
              >
                <X className="size-3" />
              </button>
            </div>
            <textarea
              value={composerDraft}
              onChange={(event) => setComposerDraft(event.target.value)}
              rows={3}
              placeholder={t('workspace.inlineCommentsPlaceholder', {
                line: composerOverlay.lineNumber,
              })}
              className="w-full resize-none rounded-md border border-border/70 bg-background/70 px-2 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground/65"
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                  event.preventDefault();
                  submitComment();
                }
              }}
            />
            <div className="mt-2 flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setComposerLine(null);
                  setComposerDraft('');
                }}
                className="rounded border border-border/70 px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                {t('workspace.cancel')}
              </button>
              <button
                type="button"
                onClick={submitComment}
                disabled={composerDraft.trim().length === 0}
                className={cn(
                  'rounded border px-2 py-1 text-xs transition-colors',
                  composerDraft.trim().length === 0
                    ? 'cursor-not-allowed border-border/60 text-muted-foreground/50'
                    : 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25',
                )}
              >
                {t('workspace.addComment')}
              </button>
            </div>
          </div>
        ) : null}

        {threadOverlay && threadComments.length > 0 ? (
          <div
            className="pointer-events-auto absolute w-[min(26rem,calc(100%-1rem))] rounded-lg border border-emerald-400/30 bg-card/95 p-2.5 shadow-lg shadow-black/35 backdrop-blur"
            style={{
              ...getLinePanelPositionStyle(threadOverlay),
              left: threadOverlay.left,
            }}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <MessageCircle className="size-3 text-emerald-300" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {t('workspace.inlineCommentsOnLine', {
                    count: threadComments.length,
                    line: threadOverlay.lineNumber,
                  })}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setThreadLine(null)}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                aria-label={t('workspace.cancel')}
                title={t('workspace.cancel')}
              >
                <X className="size-3" />
              </button>
            </div>
            <div className="max-h-60 space-y-2 overflow-y-auto pr-0.5">
              {threadComments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-md border border-border/60 bg-background/55 px-2.5 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium text-foreground">
                      {comment.authorName}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground/70">
                      {formatTime(comment.createdAt)}
                    </span>
                  </div>
                  <div className="text-xs">
                    <InlineCommentMarkdown markdown={comment.content} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function clampLine(lineNumber: number, lineCount: number): number {
  return Math.min(Math.max(1, Math.floor(lineNumber)), lineCount);
}

function isGutterMouseTarget(
  targetType: number,
  mouseTargetType: MonacoLike['editor']['MouseTargetType'],
): boolean {
  return (
    targetType === mouseTargetType.GUTTER_GLYPH_MARGIN ||
    targetType === mouseTargetType.GUTTER_LINE_NUMBERS ||
    targetType === mouseTargetType.GUTTER_LINE_DECORATIONS
  );
}

interface LinePanelOverlay {
  top: number;
  bottom: number | null;
  height: number;
  left: number;
  lineNumber: number;
}

function getVisibleLinePanelOverlay(
  editorApi: EditorLike,
  lineNumber: number,
  panelHeightEstimate: number,
): LinePanelOverlay | null {
  const visibleRanges = editorApi.getVisibleRanges();
  const isVisible = visibleRanges.some(
    (range) => lineNumber >= range.startLineNumber && lineNumber <= range.endLineNumber,
  );
  if (!isVisible) {
    return null;
  }

  const linePosition = editorApi.getScrolledVisiblePosition({
    lineNumber,
    column: 1,
  });
  if (!linePosition) {
    return null;
  }

  const layout = editorApi.getLayoutInfo();
  const editorHeight = editorApi.getDomNode()?.clientHeight ?? 0;
  const belowTop = linePosition.top + linePosition.height + INLINE_COMMENT_PANEL_GAP_PX;
  const spaceBelow = Math.max(editorHeight - belowTop, 0);
  const spaceAbove = Math.max(linePosition.top - INLINE_COMMENT_PANEL_GAP_PX, 0);
  const shouldOpenAbove =
    editorHeight > 0 && spaceBelow < panelHeightEstimate && spaceAbove > spaceBelow;

  return {
    top: belowTop,
    bottom: shouldOpenAbove
      ? Math.max(editorHeight - linePosition.top + INLINE_COMMENT_PANEL_GAP_PX, 0)
      : null,
    height: linePosition.height,
    left: layout.contentLeft + 8,
    lineNumber,
  };
}

function getLinePanelPositionStyle(
  overlay: LinePanelOverlay,
): { top: number; bottom?: undefined } | { top?: undefined; bottom: number } {
  if (overlay.bottom != null) {
    return { bottom: overlay.bottom };
  }

  return { top: overlay.top };
}
