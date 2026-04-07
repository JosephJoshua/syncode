import { Controller, Delete, Get, HttpCode, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CONTROL_API, SESSIONS_SORT_BY_OPTIONS, SORT_ORDER_OPTIONS } from '@syncode/contracts';
import { ROOM_MODES } from '@syncode/shared';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ErrorResponseDto } from '@/common/dto/error-response.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import type { AuthUser } from '@/modules/auth/auth.types';
import {
  ListSessionsQueryDto,
  SessionDetailDto,
  SessionHistoryResponseDto,
} from './dto/sessions.dto.js';
import { SessionsService } from './sessions.service.js';

@ApiTags('sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get(CONTROL_API.SESSIONS.LIST.route)
  @ApiOperation({ summary: 'List my session history' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Page size (1-100)' })
  @ApiQuery({ name: 'mode', required: false, enum: [...ROOM_MODES] })
  @ApiQuery({ name: 'fromDate', required: false, description: 'Inclusive lower bound (ISO 8601)' })
  @ApiQuery({ name: 'toDate', required: false, description: 'Inclusive upper bound (ISO 8601)' })
  @ApiQuery({ name: 'problemId', required: false, description: 'Filter by problem UUID' })
  @ApiQuery({ name: 'sortBy', required: false, enum: [...SESSIONS_SORT_BY_OPTIONS] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: [...SORT_ORDER_OPTIONS] })
  @ApiResponse({
    status: 200,
    type: SessionHistoryResponseDto,
    description: 'Paginated session list',
  })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation error' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  async listSessions(
    @CurrentUser() user: AuthUser,
    @Query() query: ListSessionsQueryDto,
  ): Promise<SessionHistoryResponseDto> {
    const isAdmin = await this.sessionsService.isAdmin(user.id);
    const result = await this.sessionsService.listSessions(user.id, query, isAdmin);
    return {
      data: result.data.map((session) => ({
        ...session,
        createdAt: session.createdAt.toISOString(),
        finishedAt: session.finishedAt?.toISOString() ?? null,
      })),
      pagination: result.pagination,
    };
  }

  @Get(CONTROL_API.SESSIONS.GET.route)
  @ApiOperation({ summary: 'Get session details' })
  @ApiParam({ name: 'id', description: 'Session ID (UUID)' })
  @ApiResponse({ status: 200, type: SessionDetailDto, description: 'Session detail' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    type: ErrorResponseDto,
    description: 'Not a participant of this session',
  })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Session not found' })
  async getSession(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<SessionDetailDto> {
    const isAdmin = await this.sessionsService.isAdmin(user.id);
    const result = await this.sessionsService.getSession(id, user.id, isAdmin);
    return {
      ...result,
      participants: result.participants.map((p) => ({
        ...p,
        joinedAt: p.joinedAt.toISOString(),
        leftAt: p.leftAt?.toISOString() ?? null,
      })),
      runs: result.runs.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
      submissions: result.submissions.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
      })),
      createdAt: result.createdAt.toISOString(),
      finishedAt: result.finishedAt?.toISOString() ?? null,
    };
  }

  @Delete(CONTROL_API.SESSIONS.DELETE.route)
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft-delete a session from history' })
  @ApiParam({ name: 'id', description: 'Session ID (UUID)' })
  @ApiResponse({ status: 204, description: 'Session soft-deleted' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    type: ErrorResponseDto,
    description: 'Not a participant of this session',
  })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Session not found' })
  async deleteSession(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    const isAdmin = await this.sessionsService.isAdmin(user.id);
    await this.sessionsService.deleteSession(id, user.id, isAdmin);
  }
}
