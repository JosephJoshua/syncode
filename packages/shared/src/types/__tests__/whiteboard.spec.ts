import { describe, expect, it } from 'vitest';
import {
  isWhiteboardContentType,
  isWhiteboardImageType,
  isWhiteboardLayer,
  isWhiteboardVideoType,
  maxBytesForContentType,
  WHITEBOARD_ASSET_LIMITS,
  WHITEBOARD_LAYERS,
} from '../whiteboard.js';

describe('isWhiteboardLayer', () => {
  it('GIVEN drawing string WHEN checking THEN returns true', () => {
    expect(isWhiteboardLayer('drawing')).toBe(true);
  });

  it('GIVEN annotation string WHEN checking THEN returns true', () => {
    expect(isWhiteboardLayer('annotation')).toBe(true);
  });

  it('GIVEN unknown string WHEN checking THEN returns false', () => {
    expect(isWhiteboardLayer('scribble')).toBe(false);
  });

  it('GIVEN every WHITEBOARD_LAYERS entry WHEN checking THEN returns true', () => {
    for (const layer of WHITEBOARD_LAYERS) {
      expect(isWhiteboardLayer(layer)).toBe(true);
    }
  });
});

describe('isWhiteboardImageType', () => {
  it('GIVEN image/png WHEN checking THEN returns true', () => {
    expect(isWhiteboardImageType('image/png')).toBe(true);
  });

  it('GIVEN image/bmp WHEN checking THEN returns false', () => {
    expect(isWhiteboardImageType('image/bmp')).toBe(false);
  });

  it('GIVEN video/mp4 WHEN checking THEN returns false', () => {
    expect(isWhiteboardImageType('video/mp4')).toBe(false);
  });
});

describe('isWhiteboardVideoType', () => {
  it('GIVEN video/mp4 WHEN checking THEN returns true', () => {
    expect(isWhiteboardVideoType('video/mp4')).toBe(true);
  });

  it('GIVEN video/avi WHEN checking THEN returns false', () => {
    expect(isWhiteboardVideoType('video/avi')).toBe(false);
  });
});

describe('isWhiteboardContentType', () => {
  it('GIVEN allowed image type WHEN checking THEN returns true', () => {
    expect(isWhiteboardContentType('image/webp')).toBe(true);
  });

  it('GIVEN allowed video type WHEN checking THEN returns true', () => {
    expect(isWhiteboardContentType('video/webm')).toBe(true);
  });

  it('GIVEN application/pdf WHEN checking THEN returns false', () => {
    expect(isWhiteboardContentType('application/pdf')).toBe(false);
  });
});

describe('maxBytesForContentType', () => {
  it('GIVEN image type WHEN checking THEN returns image limit', () => {
    expect(maxBytesForContentType('image/png')).toBe(WHITEBOARD_ASSET_LIMITS.MAX_IMAGE_BYTES);
  });

  it('GIVEN video type WHEN checking THEN returns video limit', () => {
    expect(maxBytesForContentType('video/mp4')).toBe(WHITEBOARD_ASSET_LIMITS.MAX_VIDEO_BYTES);
  });

  it('GIVEN limits WHEN comparing THEN video limit is greater than image limit', () => {
    expect(WHITEBOARD_ASSET_LIMITS.MAX_VIDEO_BYTES).toBeGreaterThan(
      WHITEBOARD_ASSET_LIMITS.MAX_IMAGE_BYTES,
    );
  });
});
