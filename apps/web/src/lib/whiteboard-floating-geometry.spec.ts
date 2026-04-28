import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clampPosition,
  clampSize,
  computeResizeFromCorner,
  FLOATING_EDGE_PADDING,
  FLOATING_MIN_HEIGHT,
  FLOATING_MIN_WIDTH,
  type ResizeCorner,
  readGeom,
  writeGeom,
} from './whiteboard-floating-geometry.js';

describe('computeResizeFromCorner', () => {
  const origin = { width: 200, height: 150, x: 100, y: 80 };

  it('GIVEN corner br WHEN dragging right and down THEN width and height grow but x and y are unchanged', () => {
    expect(computeResizeFromCorner('br', origin, 50, 30)).toEqual({
      rawWidth: 250,
      rawHeight: 180,
      rawX: 100,
      rawY: 80,
    });
  });

  it('GIVEN corner tr WHEN dragging right and up THEN width grows AND y compensates so the bottom edge stays pinned', () => {
    expect(computeResizeFromCorner('tr', origin, 40, -25)).toEqual({
      rawWidth: 240,
      rawHeight: 175,
      rawX: 100,
      rawY: 55,
    });
  });

  it('GIVEN corner bl WHEN dragging left and down THEN width grows from the left AND x compensates', () => {
    expect(computeResizeFromCorner('bl', origin, -30, 20)).toEqual({
      rawWidth: 230,
      rawHeight: 170,
      rawX: 70,
      rawY: 80,
    });
  });

  it('GIVEN corner tl WHEN dragging left and up THEN both x and y compensate so the bottom-right edge stays pinned', () => {
    expect(computeResizeFromCorner('tl', origin, -10, -15)).toEqual({
      rawWidth: 210,
      rawHeight: 165,
      rawX: 90,
      rawY: 65,
    });
  });

  it.each<ResizeCorner>([
    'tl',
    'tr',
    'bl',
    'br',
  ])('GIVEN zero delta on corner %s THEN returns the origin geometry unchanged', (corner) => {
    const result = computeResizeFromCorner(corner, origin, 0, 0);
    expect(result.rawWidth).toBe(origin.width);
    expect(result.rawHeight).toBe(origin.height);
    expect(result.rawX).toBe(origin.x);
    expect(result.rawY).toBe(origin.y);
  });
});

describe('clampPosition', () => {
  it('GIVEN position inside viewport WHEN clamping THEN returns unchanged', () => {
    expect(clampPosition(100, 80, 480, 360, 1440, 900)).toEqual({ x: 100, y: 80 });
  });

  it('GIVEN x past right edge WHEN clamping THEN snaps to maxX with edge padding', () => {
    const result = clampPosition(2000, 80, 480, 360, 1440, 900);
    expect(result.x).toBe(1440 - 480 - FLOATING_EDGE_PADDING);
    expect(result.y).toBe(80);
  });

  it('GIVEN x below left edge WHEN clamping THEN snaps to edge padding', () => {
    expect(clampPosition(-100, 80, 480, 360, 1440, 900).x).toBe(FLOATING_EDGE_PADDING);
  });

  it('GIVEN viewport smaller than panel WHEN clamping THEN minimum is the edge padding', () => {
    expect(clampPosition(0, 0, 1000, 800, 600, 400)).toEqual({
      x: FLOATING_EDGE_PADDING,
      y: FLOATING_EDGE_PADDING,
    });
  });
});

describe('clampSize', () => {
  it('GIVEN size within bounds WHEN clamping THEN returns unchanged', () => {
    expect(clampSize(480, 360, 1440, 900)).toEqual({ width: 480, height: 360 });
  });

  it('GIVEN width below minimum WHEN clamping THEN floors to FLOATING_MIN_WIDTH', () => {
    expect(clampSize(50, 360, 1440, 900).width).toBe(FLOATING_MIN_WIDTH);
  });

  it('GIVEN width above viewport bound WHEN clamping THEN ceils to viewport minus padding', () => {
    const result = clampSize(5000, 360, 1440, 900);
    expect(result.width).toBeLessThanOrEqual(1440);
  });

  it('GIVEN height below minimum WHEN clamping THEN floors to FLOATING_MIN_HEIGHT', () => {
    expect(clampSize(480, 50, 1440, 900).height).toBe(FLOATING_MIN_HEIGHT);
  });
});

describe('readGeom / writeGeom', () => {
  // CI's coverage runner ships a localStorage shim without a `clear()`
  // method. Use removeItem on each known key so the cleanup works in every
  // jsdom variant (vitest happy-dom, v8 coverage proxy, etc.).
  const TEST_KEY = 'whiteboard:floating:geom:room-1:user-1';
  const reset = () => {
    try {
      window.localStorage.removeItem(TEST_KEY);
    } catch {
      // ignore environments without localStorage at all
    }
  };

  beforeEach(reset);
  afterEach(reset);

  it('GIVEN no value persisted WHEN reading THEN returns null', () => {
    expect(readGeom(TEST_KEY)).toBeNull();
  });

  it('GIVEN written value WHEN reading THEN returns the same geometry object', () => {
    const geom = { x: 50, y: 60, width: 480, height: 360 };
    writeGeom(TEST_KEY, geom);
    expect(readGeom(TEST_KEY)).toEqual(geom);
  });

  it('GIVEN malformed JSON WHEN reading THEN returns null without throwing', () => {
    window.localStorage.setItem(TEST_KEY, '{ "broken":');
    expect(readGeom(TEST_KEY)).toBeNull();
  });

  it('GIVEN missing fields WHEN reading THEN returns null', () => {
    window.localStorage.setItem(TEST_KEY, JSON.stringify({ x: 1 }));
    expect(readGeom(TEST_KEY)).toBeNull();
  });

  it('GIVEN string field instead of number WHEN reading THEN returns null', () => {
    window.localStorage.setItem(TEST_KEY, JSON.stringify({ x: '1', y: 2, width: 3, height: 4 }));
    expect(readGeom(TEST_KEY)).toBeNull();
  });
});
