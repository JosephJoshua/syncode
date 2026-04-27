// DOM helpers for correlating Monaco/Yjs remote cursor elements to awareness clientIDs.
// The class shape `yRemoteSelectionHead-<number>` is emitted by y-monaco; keep the
// parsing strict so unrelated elements never resolve to a clientID.

const CLIENT_ID_CLASS_PATTERN = /(?:^|\s)yRemoteSelectionHead-(\d+)(?=\s|$)/;

export function remoteCursorSelector(): string {
  return '[class*="yRemoteSelectionHead-"]';
}

export function clientIdFromElement(el: Element | null): number | null {
  if (!el) return null;
  const className = typeof el.className === 'string' ? el.className : el.getAttribute('class');
  if (!className) return null;
  const match = className.match(CLIENT_ID_CLASS_PATTERN);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) ? id : null;
}
