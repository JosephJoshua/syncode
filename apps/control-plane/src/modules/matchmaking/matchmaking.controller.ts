import { Body, Controller, Delete, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CONTROL_API } from '@syncode/contracts';
import { CurrentUser } from '@/common/decorators/current-user.decorator.js';
import { ErrorResponseDto } from '@/common/dto/error-response.dto.js';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard.js';
import type { AuthUser } from '@/modules/auth/auth.types.js';
import {
  EnterMatchmakingQueueDto,
  EnterMatchmakingQueueResponseDto,
  GetMatchmakingStatusResponseDto,
  LeaveMatchmakingQueueResponseDto,
} from './dto/matchmaking.dto.js';
import { MatchmakingService } from './matchmaking.service.js';

@ApiTags('matchmaking')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class MatchmakingController {
  constructor(private readonly matchmakingService: MatchmakingService) {}

  @Post(CONTROL_API.MATCHMAKING.ENTER_QUEUE.route)
  @HttpCode(200)
  @ApiOperation({ summary: 'Enter matchmaking queue with preferences' })
  @ApiBody({ type: EnterMatchmakingQueueDto })
  @ApiResponse({ status: 200, type: EnterMatchmakingQueueResponseDto })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  async enterQueue(
    @CurrentUser() user: AuthUser,
    @Body() body: EnterMatchmakingQueueDto,
  ): Promise<EnterMatchmakingQueueResponseDto> {
    return this.matchmakingService.enterQueue(user.id, body);
  }

  @Delete(CONTROL_API.MATCHMAKING.LEAVE_QUEUE.route)
  @HttpCode(200)
  @ApiOperation({ summary: 'Leave matchmaking queue' })
  @ApiResponse({ status: 200, type: LeaveMatchmakingQueueResponseDto })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  async leaveQueue(@CurrentUser() user: AuthUser): Promise<LeaveMatchmakingQueueResponseDto> {
    return this.matchmakingService.leaveQueue(user.id);
  }

  @Get(CONTROL_API.MATCHMAKING.GET_QUEUE_STATUS.route)
  @ApiOperation({ summary: 'Get current user matchmaking queue status' })
  @ApiResponse({ status: 200, type: GetMatchmakingStatusResponseDto })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  async getQueueStatus(@CurrentUser() user: AuthUser): Promise<GetMatchmakingStatusResponseDto> {
    return this.matchmakingService.getQueueStatus(user.id);
  }
}
