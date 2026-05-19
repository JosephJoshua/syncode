import { describe, expect, it, vi } from 'vitest';
import {
  applyWhiteboardKeyboardShortcutsState,
  nextWhiteboardKeyboardFocusState,
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

describe('nextWhiteboardKeyboardFocusState', () => {
  it('GIVEN the whiteboard previously owned keyboard focus WHEN the code editor focuses THEN keyboard ownership returns to code', () => {
    expect(
      nextWhiteboardKeyboardFocusState(
        { isCodeEditorFocused: false, whiteboardHasKeyboardFocus: true },
        { source: 'code-editor', focused: true },
      ),
    ).toEqual({ isCodeEditorFocused: true, whiteboardHasKeyboardFocus: false });
  });

  it('GIVEN code editor blur WHEN resolving focus THEN preserves the current whiteboard owner', () => {
    expect(
      nextWhiteboardKeyboardFocusState(
        { isCodeEditorFocused: true, whiteboardHasKeyboardFocus: false },
        { source: 'code-editor', focused: false },
      ),
    ).toEqual({ isCodeEditorFocused: false, whiteboardHasKeyboardFocus: false });
  });

  it('GIVEN the whiteboard receives focus WHEN resolving focus THEN whiteboard owns keyboard shortcuts', () => {
    expect(
      nextWhiteboardKeyboardFocusState(
        { isCodeEditorFocused: true, whiteboardHasKeyboardFocus: false },
        { source: 'whiteboard' },
      ),
    ).toEqual({ isCodeEditorFocused: false, whiteboardHasKeyboardFocus: true });
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
