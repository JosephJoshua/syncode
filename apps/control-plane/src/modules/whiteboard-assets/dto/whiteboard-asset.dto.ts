import {
  whiteboardAssetUploadUrlRequestSchema,
  whiteboardAssetUploadUrlResponseSchema,
  whiteboardAssetVerifyRequestSchema,
  whiteboardAssetVerifyResponseSchema,
} from '@syncode/contracts';
import { createZodDto } from 'nestjs-zod';

export class WhiteboardAssetUploadUrlRequestDto extends createZodDto(
  whiteboardAssetUploadUrlRequestSchema,
) {}

export class WhiteboardAssetUploadUrlResponseDto extends createZodDto(
  whiteboardAssetUploadUrlResponseSchema,
) {}

export class WhiteboardAssetVerifyRequestDto extends createZodDto(
  whiteboardAssetVerifyRequestSchema,
) {}

export class WhiteboardAssetVerifyResponseDto extends createZodDto(
  whiteboardAssetVerifyResponseSchema,
) {}
