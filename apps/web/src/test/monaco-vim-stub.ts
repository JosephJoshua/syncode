export function initVimMode(_editor: unknown, statusNode: HTMLElement) {
  statusNode.textContent = '-- NORMAL --';

  return {
    dispose: () => {
      statusNode.textContent = '';
    },
  };
}
