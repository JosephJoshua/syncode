import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
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
import { CurrentUser } from '@/common/decorators/current-user.decorator.js';
import { ErrorResponseDto } from '@/common/dto/error-response.dto.js';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard.js';
import type { AuthUser } from '@/modules/auth/auth.types.js';
import {
  CodeSnapshotsResponseDto,
  ListCodeSnapshotsQueryDto,
  ListSessionsQueryDto,
  SessionDetailDto,
  SessionHistoryResponseDto,
  SessionReportDto,
} from './dto/sessions.dto.js';
import { SessionReportsService } from './session-reports.service.js';
import { SessionsService } from './sessions.service.js';

@ApiTags('sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class SessionsController {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly sessionReportsService: SessionReportsService,
  ) {}

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
      data: result.data.map(({ durationMs: _, ...session }) => ({
        ...session,
        createdAt: session.createdAt.toISOString(),
        finishedAt: session.finishedAt?.toISOString() ?? null,
      })),
      pagination: result.pagination,
    };
  }

  @Get(CONTROL_API.SESSIONS.SNAPSHOTS.route)
  @ApiOperation({ summary: 'Get code snapshots for a session' })
  @ApiParam({ name: 'sessionId', description: 'Session ID (UUID)' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Page size (1-100)' })
  @ApiResponse({
    status: 200,
    type: CodeSnapshotsResponseDto,
    description: 'Paginated code snapshot list',
  })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation error' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    type: ErrorResponseDto,
    description: 'Not a participant of this session',
  })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Session not found' })
  async listSnapshots(
    @CurrentUser() user: AuthUser,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Query() query: ListCodeSnapshotsQueryDto,
  ): Promise<CodeSnapshotsResponseDto> {
    const isAdmin = await this.sessionsService.isAdmin(user.id);
    const result = await this.sessionsService.listSnapshots(sessionId, user.id, isAdmin, query);

    return {
      data: result.data.map((snapshot) => ({
        ...snapshot,
        timestamp: snapshot.timestamp.toISOString(),
      })),
      pagination: result.pagination,
    };
  }

  @Get(CONTROL_API.SESSIONS.REPORT.route)
  @ApiOperation({ summary: 'Get the current user training report for a session' })
  @ApiParam({ name: 'sessionId', description: 'Session ID (UUID)' })
  @ApiResponse({
    status: 200,
    type: SessionReportDto,
    description: 'Training report',
  })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation error' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    type: ErrorResponseDto,
    description: 'Not a participant of this session',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description: 'Session not found or report not yet generated',
  })
  async getReport(
    @CurrentUser() user: AuthUser,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ): Promise<SessionReportDto> {
    const isAdmin = await this.sessionsService.isAdmin(user.id);
    return this.sessionReportsService.getReport(sessionId, user.id, isAdmin);
  }

  @Get(CONTROL_API.SESSIONS.GET.route)
  @ApiOperation({ summary: 'Get session details' })
  @ApiParam({ name: 'id', description: 'Session ID (UUID)' })
  @ApiResponse({ status: 200, type: SessionDetailDto, description: 'Session detail' })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation error' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    type: ErrorResponseDto,
    description: 'Not a participant of this session',
  })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Session not found' })
  async getSession(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
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
      report: result.report
        ? {
            ...result.report,
            feedback: result.report.feedback ?? '',
            generatedAt: result.report.generatedAt.toISOString(),
          }
        : null,
      latestCodeSnapshot: result.latestCodeSnapshot
        ? {
            ...result.latestCodeSnapshot,
            createdAt: result.latestCodeSnapshot.createdAt.toISOString(),
          }
        : null,
      peerFeedback: (result.peerFeedback ?? []).map((feedback) => ({
        ...feedback,
        createdAt: feedback.createdAt.toISOString(),
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
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation error' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    type: ErrorResponseDto,
    description: 'Not a participant of this session',
  })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Session not found' })
  async deleteSession(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    const isAdmin = await this.sessionsService.isAdmin(user.id);
    await this.sessionsService.deleteSession(id, user.id, isAdmin);
  }
}
