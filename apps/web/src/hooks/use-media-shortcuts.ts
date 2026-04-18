import { useEffect, useRef } from 'react';

interface MediaShortcutActions {
  toggleMicrophone: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => void;
  togglePushToTalk?: (pressed: boolean) => void;
  enabled: boolean;
}

function isTyping(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  if (el.closest('.monaco-editor')) return true;
  return false;
}

export function useMediaShortcuts({
  toggleMicrophone,
  toggleCamera,
  toggleScreenShare,
  togglePushToTalk,
  enabled,
}: MediaShortcutActions) {
  const actionsRef = useRef({
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
    togglePushToTalk,
  });
  actionsRef.current = { toggleMicrophone, toggleCamera, toggleScreenShare, togglePushToTalk };

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping()) return;

      if (e.key === 'm' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        actionsRef.current.toggleMicrophone();
        return;
      }

      if (e.key === 'e' && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        actionsRef.current.toggleCamera();
        return;
      }

      if (e.key === 'S' && (e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey) {
        e.preventDefault();
        actionsRef.current.toggleScreenShare();
        return;
      }

      if (e.code === 'Space' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        actionsRef.current.togglePushToTalk?.(true);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        actionsRef.current.togglePushToTalk?.(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [enabled]);
}
