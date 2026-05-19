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

export interface WhiteboardKeyboardOwnershipState {
  isCodeEditorFocused: boolean;
  whiteboardHasKeyboardFocus: boolean;
}

export type WhiteboardKeyboardFocusEvent =
  | { source: 'code-editor'; focused: boolean }
  | { source: 'whiteboard' };

export function nextWhiteboardKeyboardFocusState(
  _state: WhiteboardKeyboardOwnershipState,
  event: WhiteboardKeyboardFocusEvent,
): WhiteboardKeyboardOwnershipState {
  if (event.source === 'whiteboard') {
    return { isCodeEditorFocused: false, whiteboardHasKeyboardFocus: true };
  }

  if (event.focused) {
    return { isCodeEditorFocused: true, whiteboardHasKeyboardFocus: false };
  }

  return { isCodeEditorFocused: false, whiteboardHasKeyboardFocus: false };
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
