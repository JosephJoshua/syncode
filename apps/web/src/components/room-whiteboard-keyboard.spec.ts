import { describe, expect, it, vi } from 'vitest';
import {
  applyWhiteboardKeyboardShortcutsState,
  shouldEnableWhiteboardKeyboardShortcuts,
  type WhiteboardKeyboardFocusController,
} from './room-whiteboard-keyboard.js';

describe('shouldEnableWhiteboardKeyboardShortcuts', () => {
  it('enables shortcuts when the whiteboard tab is active', () => {
    expect(
      shouldEnableWhiteboardKeyboardShortcuts({
        activeCenterTab: 'whiteboard',
        whiteboardViewMode: 'tab',
        isCodeEditorFocused: true,
        whiteboardHasKeyboardFocus: false,
      }),
    ).toBe(true);
  });

  it('disables floating whiteboard shortcuts while the code editor is focused', () => {
    expect(
      shouldEnableWhiteboardKeyboardShortcuts({
        activeCenterTab: 'code',
        whiteboardViewMode: 'floating',
        isCodeEditorFocused: true,
        whiteboardHasKeyboardFocus: true,
      }),
    ).toBe(false);
  });

  it('enables floating whiteboard shortcuts after the user focuses the whiteboard', () => {
    expect(
      shouldEnableWhiteboardKeyboardShortcuts({
        activeCenterTab: 'code',
        whiteboardViewMode: 'floating',
        isCodeEditorFocused: false,
        whiteboardHasKeyboardFocus: true,
      }),
    ).toBe(true);
  });

  it('keeps shortcuts disabled for a hidden docked whiteboard', () => {
    expect(
      shouldEnableWhiteboardKeyboardShortcuts({
        activeCenterTab: 'code',
        whiteboardViewMode: 'tab',
        isCodeEditorFocused: false,
        whiteboardHasKeyboardFocus: true,
      }),
    ).toBe(false);
  });
});

describe('applyWhiteboardKeyboardShortcutsState', () => {
  it('uses transient editor focus instead of persistent user preferences', () => {
    const editor: WhiteboardKeyboardFocusController & {
      user: { updateUserPreferences: ReturnType<typeof vi.fn> };
    } = {
      focus: vi.fn(),
      blur: vi.fn(),
      user: { updateUserPreferences: vi.fn() },
    };

    applyWhiteboardKeyboardShortcutsState(editor, true);
    applyWhiteboardKeyboardShortcutsState(editor, false);

    expect(editor.focus).toHaveBeenCalledWith({ focusContainer: false });
    expect(editor.blur).toHaveBeenCalledWith({ blurContainer: false });
    expect(editor.user.updateUserPreferences).not.toHaveBeenCalled();
  });
});
