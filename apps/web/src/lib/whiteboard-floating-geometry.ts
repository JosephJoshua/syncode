// Pure helpers for the floating whiteboard panel: corner-based resize math
// and per-room/user geometry persistence. Kept separate from the component
// so they can be unit-tested without spinning up jsdom + React.

export type ResizeCorner = 'tl' | 'tr' | 'bl' | 'br';

export interface PersistedGeom {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const FLOATING_DEFAULT_WIDTH = 480;
export const FLOATING_DEFAULT_HEIGHT = 360;
export const FLOATING_MIN_WIDTH = 320;
export const FLOATING_MIN_HEIGHT = 240;
export const FLOATING_HEADER_HEIGHT = 28;
export const FLOATING_EDGE_PADDING = 8;
export const FLOATING_VIEWPORT_PADDING = 32;
export const FLOATING_STORAGE_PREFIX = 'whiteboard:floating:geom';

export function readGeom(key: string): PersistedGeom | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedGeom>;
    if (
      typeof parsed.x === 'number' &&
      typeof parsed.y === 'number' &&
      typeof parsed.width === 'number' &&
      typeof parsed.height === 'number'
    ) {
      return parsed as PersistedGeom;
    }
  } catch {
    // ignore — corrupt storage falls back to defaults
  }
  return null;
}

export function writeGeom(key: string, geom: PersistedGeom): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(geom));
  } catch {
    // ignore quota / private mode failures
  }
}

// Given the dragged corner and the original geometry, compute the requested
// next geometry. Top/left corners require the position to compensate so the
// opposite edge stays pinned during the drag.
export function computeResizeFromCorner(
  corner: ResizeCorner,
  origin: { width: number; height: number; x: number; y: number },
  dx: number,
  dy: number,
): { rawWidth: number; rawHeight: number; rawX: number; rawY: number } {
  switch (corner) {
    case 'br':
      return {
        rawWidth: origin.width + dx,
        rawHeight: origin.height + dy,
        rawX: origin.x,
        rawY: origin.y,
      };
    case 'tr':
      return {
        rawWidth: origin.width + dx,
        rawHeight: origin.height - dy,
        rawX: origin.x,
        rawY: origin.y + dy,
      };
    case 'bl':
      return {
        rawWidth: origin.width - dx,
        rawHeight: origin.height + dy,
        rawX: origin.x + dx,
        rawY: origin.y,
      };
    default:
      return {
        rawWidth: origin.width - dx,
        rawHeight: origin.height - dy,
        rawX: origin.x + dx,
        rawY: origin.y + dy,
      };
  }
}

// Clamp a candidate position so the panel stays inside the viewport with
// EDGE_PADDING on each side.
export function clampPosition(
  x: number,
  y: number,
  panelWidth: number,
  panelHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number } {
  const maxX = Math.max(FLOATING_EDGE_PADDING, viewportWidth - panelWidth - FLOATING_EDGE_PADDING);
  const maxY = Math.max(
    FLOATING_EDGE_PADDING,
    viewportHeight - panelHeight - FLOATING_EDGE_PADDING,
  );
  return {
    x: Math.max(FLOATING_EDGE_PADDING, Math.min(maxX, x)),
    y: Math.max(FLOATING_EDGE_PADDING, Math.min(maxY, y)),
  };
}

// Clamp a candidate size so the panel stays at least minimum-sized AND fits
// inside the viewport with VIEWPORT_PADDING on each side.
export function clampSize(
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
): { width: number; height: number } {
  const maxW = Math.max(FLOATING_MIN_WIDTH, viewportWidth - FLOATING_VIEWPORT_PADDING);
  const maxH = Math.max(FLOATING_MIN_HEIGHT, viewportHeight - FLOATING_VIEWPORT_PADDING);
  return {
    width: Math.max(FLOATING_MIN_WIDTH, Math.min(maxW, width)),
    height: Math.max(FLOATING_MIN_HEIGHT, Math.min(maxH, height)),
  };
}
