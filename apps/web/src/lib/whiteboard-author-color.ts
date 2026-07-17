// Stable, deterministic colors for whiteboard authors. A discrete palette
// with N entries collides at ~1/N rate, which made author dots look almost
// identical for two-user rooms. We instead map each user id to a hue on a
// continuous 360° wheel using a golden-angle multiplier (137.5°), which
// guarantees that the next k user ids occupy maximally-distant hues for any
// k up to ~360 / 137.5 ≈ 2.6 — i.e. consecutive authors are always far apart.
const HUE_GOLDEN_ANGLE = 137.508;

// 32-bit FNV-1a-ish string hash. Disperses similar inputs (UUIDs that share
// a prefix) into very different hash values so we don't get clustered hues.
function hashString(value: string): number {
  let hash = 2_166_136_261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export function authorColor(userId: string): string {
  const hash = hashString(userId);
  // Modulate the hue by the hash so similar user ids land on different
  // hues, then nudge by golden-angle multiples for additional spread.
  const hue = (hash * HUE_GOLDEN_ANGLE) % 360;
  // Slight saturation/lightness variation per user keeps two ids that
  // happen to land on near-identical hues distinguishable.
  const saturation = 65 + ((hash >> 8) % 20); // 65-84
  const lightness = 48 + ((hash >> 16) % 12); // 48-59
  return `hsl(${Math.floor(hue)}, ${saturation}%, ${lightness}%)`;
}
