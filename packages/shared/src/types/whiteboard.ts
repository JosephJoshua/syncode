export const WHITEBOARD_LAYERS = ['drawing', 'annotation'] as const;

export type WhiteboardLayer = (typeof WHITEBOARD_LAYERS)[number];

export function isWhiteboardLayer(value: string): value is WhiteboardLayer {
  return (WHITEBOARD_LAYERS as readonly string[]).includes(value);
}

export interface WhiteboardShapeMeta {
  authorId: string;
  layer: WhiteboardLayer;
  createdAt: number;
}

export interface WhiteboardAssetMeta extends WhiteboardShapeMeta {
  storageKey: string;
}

export const WHITEBOARD_ASSET_LIMITS = {
  MAX_IMAGE_BYTES: 25 * 1024 * 1024,
  MAX_VIDEO_BYTES: 100 * 1024 * 1024,
} as const;

export const WHITEBOARD_ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
] as const;

export const WHITEBOARD_ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'] as const;

export type WhiteboardAllowedImageType = (typeof WHITEBOARD_ALLOWED_IMAGE_TYPES)[number];
export type WhiteboardAllowedVideoType = (typeof WHITEBOARD_ALLOWED_VIDEO_TYPES)[number];
export type WhiteboardAllowedContentType = WhiteboardAllowedImageType | WhiteboardAllowedVideoType;

export function isWhiteboardImageType(value: string): value is WhiteboardAllowedImageType {
  return (WHITEBOARD_ALLOWED_IMAGE_TYPES as readonly string[]).includes(value);
}

export function isWhiteboardVideoType(value: string): value is WhiteboardAllowedVideoType {
  return (WHITEBOARD_ALLOWED_VIDEO_TYPES as readonly string[]).includes(value);
}

export function isWhiteboardContentType(value: string): value is WhiteboardAllowedContentType {
  return isWhiteboardImageType(value) || isWhiteboardVideoType(value);
}

export function maxBytesForContentType(value: WhiteboardAllowedContentType): number {
  return isWhiteboardImageType(value)
    ? WHITEBOARD_ASSET_LIMITS.MAX_IMAGE_BYTES
    : WHITEBOARD_ASSET_LIMITS.MAX_VIDEO_BYTES;
}
