declare module 'monaco-vim' {
  export interface MonacoVimDisposable {
    dispose: () => void;
  }

  export function initVimMode(editor: unknown, statusNode: HTMLElement): MonacoVimDisposable;
}

declare module 'monaco-emacs' {
  export interface MonacoEmacsDisposable {
    dispose: () => void;
  }

  export default class EmacsExtension {
    constructor(editor: unknown);
    start(): void;
    dispose(): void;
    onDidChangeKey(listener: (key: string) => void): MonacoEmacsDisposable;
  }
}
