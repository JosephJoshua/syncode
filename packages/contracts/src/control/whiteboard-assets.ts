import {
  WHITEBOARD_ALLOWED_IMAGE_TYPES,
  WHITEBOARD_ALLOWED_VIDEO_TYPES,
  WHITEBOARD_ASSET_LIMITS,
} from '@syncode/shared';
import { z } from 'zod';

const allowedContentTypes = [
  ...WHITEBOARD_ALLOWED_IMAGE_TYPES,
  ...WHITEBOARD_ALLOWED_VIDEO_TYPES,
] as const;

export const whiteboardAssetUploadUrlRequestSchema = z
  .object({
    filename: z
      .string()
      .min(1)
      .max(255)
      .describe('Original filename — used for the storage key suffix and content disposition'),
    contentType: z
      .enum(allowedContentTypes)
      .describe('MIME type of the uploaded asset; restricted to whitelisted image/video types'),
    contentLength: z
      .number()
      .int()
      .positive()
      .max(WHITEBOARD_ASSET_LIMITS.MAX_VIDEO_BYTES)
      .describe('Size in bytes; further restricted per content category at the controller'),
  })
  .strict();

export type WhiteboardAssetUploadUrlRequest = z.infer<typeof whiteboardAssetUploadUrlRequestSchema>;

export const whiteboardAssetUploadUrlResponseSchema = z.object({
  uploadUrl: z
    .string()
    .describe('Presigned PUT URL for direct S3 upload')
    .meta({ examples: ['https://cdn.syncode.app/whiteboard/abc/file?X-Amz-...'] }),
  downloadUrl: z
    .string()
    .describe('Presigned GET URL the client should embed in the tldraw asset record')
    .meta({ examples: ['https://cdn.syncode.app/whiteboard/abc/file?X-Amz-...'] }),
  key: z
    .string()
    .describe('S3 object key for the asset; tldraw stores this in asset meta for cleanup')
    .meta({ examples: ['whiteboard/room-123/abc-diagram.png'] }),
});

export type WhiteboardAssetUploadUrlResponse = z.infer<
  typeof whiteboardAssetUploadUrlResponseSchema
>;
