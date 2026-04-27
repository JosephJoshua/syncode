// Stable, deterministic colors for whiteboard authors. Used for the legend
// and the per-author tint when an author has no live awareness state to read
// their own collab color from. Palette mirrors the cursor highlight palette
// used by other collab UI so the same userId yields a consistent visual hue
// across the editor and the whiteboard.
const PALETTE = [
  '#ef4444', // red-500
  '#f97316', // orange-500
  '#eab308', // yellow-500
  '#22c55e', // green-500
  '#06b6d4', // cyan-500
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
] as const;

export function authorColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % PALETTE.length;
  return PALETTE[idx] ?? PALETTE[0];
}

export const AUTHOR_COLOR_PALETTE = PALETTE;
