export type EditorKeybindingMode = 'default' | 'vim' | 'emacs';

export const EDITOR_KEYBINDING_MODE_STORAGE_KEY = 'syncode.editor.keybindingMode';

export const EDITOR_KEYBINDING_MODES: Array<{
  readonly value: EditorKeybindingMode;
  readonly labelKey: string;
}> = [
  { value: 'default', labelKey: 'workspace.editorModeDefault' },
  { value: 'vim', labelKey: 'workspace.editorModeVim' },
  { value: 'emacs', labelKey: 'workspace.editorModeEmacs' },
];

interface DisposableLike {
  dispose: () => void;
}

interface MountEditorKeybindingModeInput {
  readonly editor: unknown;
  readonly mode: EditorKeybindingMode;
  readonly statusNode: HTMLElement;
}

export function isEditorKeybindingMode(value: unknown): value is EditorKeybindingMode {
  return EDITOR_KEYBINDING_MODES.some((option) => option.value === value);
}

export async function mountEditorKeybindingMode({
  editor,
  mode,
  statusNode,
}: MountEditorKeybindingModeInput): Promise<DisposableLike> {
  statusNode.textContent = '';

  if (mode === 'default') {
    return { dispose: () => undefined };
  }

  if (mode === 'vim') {
    const { initVimMode } = await import('monaco-vim');
    return initVimMode(editor as Parameters<typeof initVimMode>[0], statusNode);
  }

  const { default: EmacsExtension } = await import('monaco-emacs');
  const extension = new EmacsExtension(editor as ConstructorParameters<typeof EmacsExtension>[0]);
  extension.start();
  statusNode.textContent = 'Emacs';
  const keyDisposable = extension.onDidChangeKey((key) => {
    statusNode.textContent = key || 'Emacs';
  });

  return {
    dispose: () => {
      keyDisposable.dispose();
      extension.dispose();
      statusNode.textContent = '';
    },
  };
}

export function readStoredEditorKeybindingMode(): EditorKeybindingMode {
  if (typeof window === 'undefined') {
    return 'default';
  }

  try {
    const stored = window.localStorage.getItem(EDITOR_KEYBINDING_MODE_STORAGE_KEY);
    return isEditorKeybindingMode(stored) ? stored : 'default';
  } catch {
    return 'default';
  }
}

export function writeStoredEditorKeybindingMode(mode: EditorKeybindingMode): void {
  try {
    window.localStorage.setItem(EDITOR_KEYBINDING_MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore storage failures; the in-memory selection still applies for this session.
  }
}
