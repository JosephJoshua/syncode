import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CONTROL_API } from '@syncode/contracts';
import { CurrentUser } from '@/common/decorators/current-user.decorator.js';
import { ErrorResponseDto } from '@/common/dto/error-response.dto.js';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard.js';
import {
  WhiteboardAssetUploadUrlRequestDto,
  WhiteboardAssetUploadUrlResponseDto,
  WhiteboardAssetVerifyRequestDto,
  WhiteboardAssetVerifyResponseDto,
} from './dto/whiteboard-asset.dto.js';
import { WhiteboardAssetsService } from './whiteboard-assets.service.js';

@ApiTags('whiteboard-assets')
@Controller()
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class WhiteboardAssetsController {
  constructor(private readonly assetsService: WhiteboardAssetsService) {}

  @Post(CONTROL_API.WHITEBOARD_ASSETS.UPLOAD_URL.route)
  @ApiOperation({ summary: 'Get a presigned URL to upload a whiteboard asset to S3' })
  @ApiParam({ name: 'id', description: 'Room ID', example: '497f6eca-6276-4993-bfeb-53cbbbba6f08' })
  @ApiBody({ type: WhiteboardAssetUploadUrlRequestDto })
  @ApiResponse({
    status: 201,
    type: WhiteboardAssetUploadUrlResponseDto,
    description: 'Presigned upload + download URLs and storage key',
  })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation error' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    type: ErrorResponseDto,
    description: 'Forbidden — not a participant or lacks whiteboard write permission',
  })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Room not found' })
  @ApiResponse({
    status: 413,
    type: ErrorResponseDto,
    description: 'Upload exceeds maximum size for the content type',
  })
  async getUploadUrl(
    @Param('id') roomId: string,
    @CurrentUser() user: { id: string },
    @Body() body: WhiteboardAssetUploadUrlRequestDto,
  ): Promise<WhiteboardAssetUploadUrlResponseDto> {
    return this.assetsService.createUploadUrl({
      roomId,
      userId: user.id,
      filename: body.filename,
      contentType: body.contentType,
      contentLength: body.contentLength,
    });
  }

  @Post(CONTROL_API.WHITEBOARD_ASSETS.VERIFY.route)
  @ApiOperation({ summary: 'Verify whether a previously issued whiteboard asset key exists in S3' })
  @ApiParam({ name: 'id', description: 'Room ID', example: '497f6eca-6276-4993-bfeb-53cbbbba6f08' })
  @ApiBody({ type: WhiteboardAssetVerifyRequestDto })
  @ApiResponse({
    status: 201,
    type: WhiteboardAssetVerifyResponseDto,
    description: 'Storage existence status for the provided key',
  })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation error' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    type: ErrorResponseDto,
    description: 'Forbidden — not a participant or lacks whiteboard write permission',
  })
  async verifyAsset(
    @Param('id') roomId: string,
    @CurrentUser() user: { id: string },
    @Body() body: WhiteboardAssetVerifyRequestDto,
  ): Promise<WhiteboardAssetVerifyResponseDto> {
    return this.assetsService.verifyAsset({
      roomId,
      userId: user.id,
      key: body.key,
    });
  }
}
