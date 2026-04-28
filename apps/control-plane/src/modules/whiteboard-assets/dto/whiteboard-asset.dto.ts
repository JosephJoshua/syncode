import {
  whiteboardAssetUploadUrlRequestSchema,
  whiteboardAssetUploadUrlResponseSchema,
} from '@syncode/contracts';
import { createZodDto } from 'nestjs-zod';

export class WhiteboardAssetUploadUrlRequestDto extends createZodDto(
  whiteboardAssetUploadUrlRequestSchema,
) {}

export class WhiteboardAssetUploadUrlResponseDto extends createZodDto(
  whiteboardAssetUploadUrlResponseSchema,
) {}
