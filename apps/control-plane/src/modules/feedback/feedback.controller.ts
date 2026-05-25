import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
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
import type { AuthUser } from '@/modules/auth/auth.types.js';
import {
  SessionFeedbackProgressResponseDto,
  SessionFeedbackResponseDto,
  SkipSessionFeedbackDto,
  SubmitSessionFeedbackDto,
} from './dto/feedback.dto.js';
import { FeedbackService } from './feedback.service.js';
import type { SessionFeedbackProgressResult, SessionFeedbackResult } from './feedback.types.js';

@ApiTags('feedback')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post(CONTROL_API.FEEDBACK.SUBMIT_SESSION.route)
  @HttpCode(201)
  @ApiOperation({ summary: 'Submit peer feedback for a session' })
  @ApiParam({ name: 'id', description: 'Session ID (UUID)' })
  @ApiBody({ type: SubmitSessionFeedbackDto })
  @ApiResponse({ status: 201, type: SessionFeedbackResponseDto })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation error' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({ status: 403, type: ErrorResponseDto, description: 'Not a participant' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Session not found' })
  async submitSessionFeedback(
    @CurrentUser() user: AuthUser,
    @Param('id') sessionId: string,
    @Body() body: SubmitSessionFeedbackDto,
  ): Promise<SessionFeedbackResponseDto> {
    const isAdmin = await this.feedbackService.isAdmin(user.id);
    const result = await this.feedbackService.submitSessionFeedback(
      sessionId,
      user.id,
      body,
      isAdmin,
    );
    return serializeFeedback(result);
  }

  @Post(CONTROL_API.FEEDBACK.SKIP_SESSION.route)
  @HttpCode(200)
  @ApiOperation({ summary: 'Skip peer feedback for one participant in a session' })
  @ApiParam({ name: 'id', description: 'Session ID (UUID)' })
  @ApiBody({ type: SkipSessionFeedbackDto })
  @ApiResponse({ status: 200, type: SessionFeedbackProgressResponseDto })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation error' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({ status: 403, type: ErrorResponseDto, description: 'Not a participant' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Session not found' })
  async skipSessionFeedback(
    @CurrentUser() user: AuthUser,
    @Param('id') sessionId: string,
    @Body() body: SkipSessionFeedbackDto,
  ): Promise<SessionFeedbackProgressResponseDto> {
    const result = await this.feedbackService.skipSessionFeedback(sessionId, user.id, body);
    return serializeProgress(result);
  }

  @Post(CONTROL_API.FEEDBACK.SKIP_ALL_SESSION.route)
  @HttpCode(200)
  @ApiOperation({ summary: 'Skip all remaining peer feedback targets for a session' })
  @ApiParam({ name: 'id', description: 'Session ID (UUID)' })
  @ApiResponse({ status: 200, type: SessionFeedbackProgressResponseDto })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({ status: 403, type: ErrorResponseDto, description: 'Not a participant' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Session not found' })
  async skipAllSessionFeedback(
    @CurrentUser() user: AuthUser,
    @Param('id') sessionId: string,
  ): Promise<SessionFeedbackProgressResponseDto> {
    const result = await this.feedbackService.skipAllSessionFeedback(sessionId, user.id);
    return serializeProgress(result);
  }

  @Get(CONTROL_API.FEEDBACK.GET_SESSION.route)
  @ApiOperation({ summary: 'Get peer feedback for a session' })
  @ApiParam({ name: 'id', description: 'Session ID (UUID)' })
  @ApiResponse({ status: 200, type: SessionFeedbackResponseDto })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({ status: 403, type: ErrorResponseDto, description: 'Not a participant' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Session not found' })
  async getSessionFeedback(
    @CurrentUser() user: AuthUser,
    @Param('id') sessionId: string,
  ): Promise<SessionFeedbackResponseDto> {
    const isAdmin = await this.feedbackService.isAdmin(user.id);
    const result = await this.feedbackService.getSessionFeedback(sessionId, user.id, isAdmin);
    return serializeFeedback(result);
  }

  @Get(CONTROL_API.FEEDBACK.GET_PROGRESS.route)
  @ApiOperation({ summary: 'Get current reviewer peer feedback progress for a session' })
  @ApiParam({ name: 'id', description: 'Session ID (UUID)' })
  @ApiResponse({ status: 200, type: SessionFeedbackProgressResponseDto })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({ status: 403, type: ErrorResponseDto, description: 'Not a participant' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Session not found' })
  async getSessionFeedbackProgress(
    @CurrentUser() user: AuthUser,
    @Param('id') sessionId: string,
  ): Promise<SessionFeedbackProgressResponseDto> {
    const result = await this.feedbackService.getSessionFeedbackProgress(sessionId, user.id);
    return serializeProgress(result);
  }
}

function serializeFeedback(result: SessionFeedbackResult): SessionFeedbackResponseDto {
  return {
    allSubmitted: result.allSubmitted,
    data: result.data.map((entry) => ({
      ...entry,
      createdAt: entry.createdAt.toISOString(),
    })),
  };
}

function serializeProgress(
  result: SessionFeedbackProgressResult,
): SessionFeedbackProgressResponseDto {
  return {
    allSubmitted: result.allSubmitted,
    targets: result.targets.map((target) => ({
      ...target,
      createdAt: target.createdAt?.toISOString() ?? null,
    })),
  };
}
