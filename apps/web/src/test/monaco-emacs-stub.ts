export default class EmacsExtension {
  start(): void {}

  onDidChangeKey(listener: (key: string) => void) {
    listener('C-x');
    return { dispose: () => undefined };
  }

  dispose(): void {}
}
