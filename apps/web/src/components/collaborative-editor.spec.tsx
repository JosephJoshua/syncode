import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { codeTextKey } from '@/lib/yjs-collab-provider.js';

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
