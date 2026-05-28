import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { codeTextKey } from '@/lib/yjs-collab-provider.js';
import { CollaborativeEditor } from './collaborative-editor.js';

const fakeMonacoState = vi.hoisted(() => ({
  editor: null as FakeEditor | null,
  props: null as { options?: Record<string, unknown> } | null,
  monaco: {
    KeyMod: { CtrlCmd: 2048, Shift: 1024 },
    KeyCode: { Enter: 3 },
    editor: {
      MouseTargetType: {
        GUTTER_GLYPH_MARGIN: 2,
        GUTTER_LINE_NUMBERS: 3,
        GUTTER_LINE_DECORATIONS: 4,
      },
    },
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values?.line == null ? key : `${key} ${values.line}`,
  }),
}));

vi.mock('y-monaco', () => ({
  MonacoBinding: vi.fn().mockImplementation(() => ({ destroy: vi.fn() })),
}));

vi.mock('monaco-vim', () => ({
  initVimMode: (_editor: unknown, statusNode: HTMLElement) => {
    statusNode.textContent = '-- NORMAL --';
    return {
      dispose: () => {
        statusNode.textContent = '';
      },
    };
  },
}));

vi.mock('monaco-emacs', () => ({
  default: class {
    start() {
      return undefined;
    }

    onDidChangeKey(listener: (key: string) => void) {
      listener('C-x');
      return { dispose: () => undefined };
    }

    dispose() {
      return undefined;
    }
  },
}));

vi.mock('./lazy-monaco-editor.js', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    LazyMonacoEditor: (props: {
      onMount?: (editor: FakeEditor, monaco: typeof fakeMonacoState.monaco) => void;
      options?: Record<string, unknown>;
    }) => {
      fakeMonacoState.props = props;
      React.useEffect(() => {
        if (fakeMonacoState.editor) {
          props.onMount?.(fakeMonacoState.editor, fakeMonacoState.monaco);
        }
      }, [props]);

      return React.createElement('div', { 'data-testid': 'mock-monaco-editor' });
    },
  };
});

afterEach(() => {
  fakeMonacoState.editor = null;
  fakeMonacoState.props = null;
});

interface FakeMouseEvent {
  target: {
    type: number;
    position?: { lineNumber: number } | null;
  };
}

interface FakeEditor {
  addAction: ReturnType<typeof vi.fn>;
  getModel: () => {
    getLineCount: () => number;
    getLineContent: (lineNumber: number) => string;
    getValueInRange: () => string;
  };
  getPosition: () => { lineNumber: number };
  getSelection: () => null;
  getDomNode: () => HTMLElement;
  focus: ReturnType<typeof vi.fn>;
  onDidChangeCursorPosition: (listener: (event: { position: { lineNumber: number } }) => void) => {
    dispose: () => void;
  };
  onDidChangeCursorSelection: (listener: () => void) => { dispose: () => void };
  onDidScrollChange: (listener: () => void) => { dispose: () => void };
  onDidLayoutChange: (listener: () => void) => { dispose: () => void };
  onDidChangeModelContent: (listener: () => void) => { dispose: () => void };
  onDidFocusEditorWidget: (listener: () => void) => { dispose: () => void };
  onDidBlurEditorWidget: (listener: () => void) => { dispose: () => void };
  onMouseDown: (listener: (event: FakeMouseEvent) => void) => { dispose: () => void };
  onMouseMove: (listener: (event: FakeMouseEvent) => void) => { dispose: () => void };
  getVisibleRanges: () => Array<{ startLineNumber: number; endLineNumber: number }>;
  getLayoutInfo: () => { glyphMarginLeft: number; glyphMarginWidth: number; contentLeft: number };
  getScrolledVisiblePosition: (position: { lineNumber: number; column: number }) => {
    top: number;
    left: number;
    height: number;
  };
  deltaDecorations: ReturnType<typeof vi.fn>;
  emitMouseMove: (lineNumber: number, targetType: number) => void;
}

function createFakeEditor(options: { readonly clientHeight?: number } = {}): FakeEditor {
  const mouseMoveListeners: Array<(event: FakeMouseEvent) => void> = [];
  const disposable = () => ({ dispose: vi.fn() });
  const root = document.createElement('div');
  Object.defineProperty(root, 'clientHeight', {
    configurable: true,
    value: options.clientHeight ?? 500,
  });

  return {
    addAction: vi.fn(),
    getModel: () => ({
      getLineCount: () => 4,
      getLineContent: (lineNumber) => `line ${lineNumber}`,
      getValueInRange: () => 'selected',
    }),
    getPosition: () => ({ lineNumber: 1 }),
    getSelection: () => null,
    getDomNode: () => root,
    focus: vi.fn(),
    onDidChangeCursorPosition: () => disposable(),
    onDidChangeCursorSelection: () => disposable(),
    onDidScrollChange: () => disposable(),
    onDidLayoutChange: () => disposable(),
    onDidChangeModelContent: () => disposable(),
    onDidFocusEditorWidget: () => disposable(),
    onDidBlurEditorWidget: () => disposable(),
    onMouseDown: () => disposable(),
    onMouseMove: (listener) => {
      mouseMoveListeners.push(listener);
      return disposable();
    },
    getVisibleRanges: () => [{ startLineNumber: 1, endLineNumber: 4 }],
    getLayoutInfo: () => ({ glyphMarginLeft: 0, glyphMarginWidth: 20, contentLeft: 80 }),
    getScrolledVisiblePosition: ({ lineNumber }) => ({
      top: lineNumber * 20,
      left: 0,
      height: 20,
    }),
    deltaDecorations: vi.fn(() => []),
    emitMouseMove: (lineNumber, targetType) => {
      for (const listener of mouseMoveListeners) {
        listener({ target: { type: targetType, position: { lineNumber } } });
      }
    },
  };
}

// Unit coverage for the Y.Text key selection logic that CollaborativeEditor relies on.
// Mounting the real Monaco editor in jsdom is brittle — the important guarantee is that
// switching languages targets a different Y.Text so prior-language text is preserved.
describe('CollaborativeEditor Y.Text selection', () => {
  it('GIVEN language changes WHEN resolving Y.Text THEN switches to the new key and preserves prior text in the old key', () => {
    const doc = new Y.Doc();

    const pythonText = doc.getText(codeTextKey('python'));
    pythonText.insert(0, "print('hi')");

    const javascriptText = doc.getText(codeTextKey('javascript'));
    javascriptText.insert(0, "console.log('hi')");

    // Each language has its own Y.Text. Switching languages (re-binding MonacoBinding to
    // doc.getText(codeTextKey(newLanguage))) does not touch the prior language's Y.Text.
    expect(pythonText.toString()).toBe("print('hi')");
    expect(javascriptText.toString()).toBe("console.log('hi')");

    // Retrieving the same key returns the same shared Y.Text instance.
    expect(doc.getText(codeTextKey('python'))).toBe(pythonText);
    expect(doc.getText(codeTextKey('javascript'))).toBe(javascriptText);

    doc.destroy();
  });

  it('GIVEN identical language values WHEN resolving THEN returns the same Y.Text instance', () => {
    const doc = new Y.Doc();

    const first = doc.getText(codeTextKey('rust'));
    const second = doc.getText(codeTextKey('rust'));

    expect(first).toBe(second);

    doc.destroy();
  });
});

describe('CollaborativeEditor inline comments', () => {
  it('GIVEN the editor mounts WHEN registering shortcuts THEN plain Enter remains reserved for editing', () => {
    const doc = new Y.Doc();
    const awareness = new Awareness(doc);
    const fakeEditor = createFakeEditor();
    fakeMonacoState.editor = fakeEditor;

    render(
      <CollaborativeEditor
        doc={doc}
        awareness={awareness}
        language="python"
        readOnly={false}
        onRunCode={vi.fn()}
        onSubmitCode={vi.fn()}
      />,
    );

    const keybindings = fakeEditor.addAction.mock.calls.flatMap(([action]) => action.keybindings);
    expect(keybindings).not.toContain(fakeMonacoState.monaco.KeyCode.Enter);
    awareness.destroy();
    doc.destroy();
  });

  it('GIVEN a gutter hover on a non-cursor line WHEN adding a comment THEN targets the hovered line', async () => {
    const user = userEvent.setup();
    const doc = new Y.Doc();
    const awareness = new Awareness(doc);
    const onAddComment = vi.fn();
    const fakeEditor = createFakeEditor();
    fakeMonacoState.editor = fakeEditor;

    render(
      <CollaborativeEditor
        doc={doc}
        awareness={awareness}
        language="python"
        readOnly={false}
        canAddComments={true}
        onAddComment={onAddComment}
        onRunCode={vi.fn()}
        onSubmitCode={vi.fn()}
      />,
    );

    act(() => {
      fakeEditor.emitMouseMove(
        3,
        fakeMonacoState.monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS,
      );
    });
    await user.click(screen.getByRole('button', { name: 'workspace.addComment' }));
    await user.type(screen.getByPlaceholderText('workspace.inlineCommentsPlaceholder 3'), 'Check');
    const addButtons = screen.getAllByRole('button', { name: 'workspace.addComment' });
    const submitButton = addButtons.at(-1);
    if (!submitButton) {
      throw new Error('Expected an add-comment submit button');
    }
    await user.click(submitButton);

    expect(onAddComment).toHaveBeenCalledWith(3, 'Check');
    awareness.destroy();
    doc.destroy();
  });

  it('GIVEN the selected line is near the bottom WHEN adding a comment THEN the composer opens above the line', async () => {
    const user = userEvent.setup();
    const doc = new Y.Doc();
    const awareness = new Awareness(doc);
    const fakeEditor = createFakeEditor({ clientHeight: 100 });
    fakeMonacoState.editor = fakeEditor;

    render(
      <CollaborativeEditor
        doc={doc}
        awareness={awareness}
        language="python"
        readOnly={false}
        canAddComments={true}
        onAddComment={vi.fn()}
        onRunCode={vi.fn()}
        onSubmitCode={vi.fn()}
      />,
    );

    act(() => {
      fakeEditor.emitMouseMove(
        4,
        fakeMonacoState.monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS,
      );
    });
    await user.click(screen.getByRole('button', { name: 'workspace.addComment' }));

    const composer = screen.getByText('workspace.selectedLine 4').closest('.pointer-events-auto');

    expect(composer).not.toBeNull();
    expect((composer as HTMLElement).style.bottom).not.toBe('');
    expect((composer as HTMLElement).style.top).toBe('');
    awareness.destroy();
    doc.destroy();
  });
});

describe('CollaborativeEditor keybinding modes', () => {
  it('GIVEN Vim mode WHEN the editor mounts THEN the Vim status is visible to the user', async () => {
    const doc = new Y.Doc();
    const awareness = new Awareness(doc);
    fakeMonacoState.editor = createFakeEditor();

    render(
      <CollaborativeEditor
        doc={doc}
        awareness={awareness}
        language="python"
        readOnly={false}
        keybindingMode="vim"
        onRunCode={vi.fn()}
        onSubmitCode={vi.fn()}
      />,
    );

    expect(await screen.findByText('-- NORMAL --')).toBeInTheDocument();
    awareness.destroy();
    doc.destroy();
  });

  it('GIVEN Emacs mode WHEN the editor mounts THEN the Emacs key status is visible to the user', async () => {
    const doc = new Y.Doc();
    const awareness = new Awareness(doc);
    fakeMonacoState.editor = createFakeEditor();

    render(
      <CollaborativeEditor
        doc={doc}
        awareness={awareness}
        language="python"
        readOnly={false}
        keybindingMode="emacs"
        onRunCode={vi.fn()}
        onSubmitCode={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('C-x')).toBeInTheDocument();
    });
    awareness.destroy();
    doc.destroy();
  });
});

describe('CollaborativeEditor input surface', () => {
  // Regression guard for the digit-key hijack: when Monaco's EditContext API
  // is enabled (the Chrome default since 0.52), Monaco renders a
  // <div class="native-edit-context"> as the input surface. Tldraw's
  // OverflowingToolbar registers a *document*-level keydown that maps digits
  // 1-0 to toolbar buttons, gated only by activeElementShouldCaptureKeys —
  // which recognizes <input>/<textarea>/contenteditable but not the
  // EditContext div. Without editContext: false, every digit typed in the
  // code editor is swallowed by tldraw (and `8` opens the file picker).
  it('GIVEN the editor mounts THEN it passes editContext: false to Monaco so tldraw cannot hijack digit keys', () => {
    const doc = new Y.Doc();
    const awareness = new Awareness(doc);
    fakeMonacoState.editor = createFakeEditor();

    render(
      <CollaborativeEditor
        doc={doc}
        awareness={awareness}
        language="python"
        readOnly={false}
        onRunCode={vi.fn()}
        onSubmitCode={vi.fn()}
      />,
    );

    expect(fakeMonacoState.props?.options?.editContext).toBe(false);
    awareness.destroy();
    doc.destroy();
  });
});
