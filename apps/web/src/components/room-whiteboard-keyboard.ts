export type RoomCenterTab = 'code' | 'whiteboard';
export type WhiteboardViewMode = 'tab' | 'floating';

export interface WhiteboardKeyboardFocusController {
  focus: (options?: { focusContainer?: boolean }) => unknown;
  blur: (options?: { blurContainer?: boolean }) => unknown;
}

export interface WhiteboardKeyboardShortcutState {
  activeCenterTab: RoomCenterTab;
  whiteboardViewMode: WhiteboardViewMode;
  isCodeEditorFocused: boolean;
  whiteboardHasKeyboardFocus: boolean;
}

export function shouldEnableWhiteboardKeyboardShortcuts({
  activeCenterTab,
  whiteboardViewMode,
  isCodeEditorFocused,
  whiteboardHasKeyboardFocus,
}: WhiteboardKeyboardShortcutState): boolean {
  if (activeCenterTab === 'whiteboard') {
    return true;
  }

  return whiteboardViewMode === 'floating' && whiteboardHasKeyboardFocus && !isCodeEditorFocused;
}

export function applyWhiteboardKeyboardShortcutsState(
  editor: WhiteboardKeyboardFocusController,
  enabled: boolean,
): void {
  if (enabled) {
    editor.focus({ focusContainer: false });
    return;
  }

  editor.blur({ blurContainer: false });
}
