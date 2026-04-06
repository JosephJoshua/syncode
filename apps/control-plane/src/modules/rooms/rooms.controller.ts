import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CONTROL_API, ROOMS_SORT_BY_OPTIONS, SORT_ORDER_OPTIONS } from '@syncode/contracts';
import { ROOM_MODES, ROOM_STATUSES } from '@syncode/shared';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Idempotent } from '@/common/decorators/idempotent.decorator';
import { ErrorResponseDto } from '@/common/dto/error-response.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { IdempotencyInterceptor } from '@/common/interceptors/idempotency.interceptor';
import type { AuthUser } from '@/modules/auth/auth.types';
import {
  CreateRoomDto,
  CreateRoomResponseDto,
  DestroyRoomResponseDto,
  JoinRoomDto,
  JoinRoomResponseDto,
  ListRoomsQueryDto,
  ListRoomsResponseDto,
  RoomDetailDto,
  RunCodeDto,
  RunCodeResponseDto,
  SubmitProblemDto,
  SubmitResultItemDto,
} from './dto/rooms.dto.js';
import { RoomsService } from './rooms.service.js';

/**
 * Manages room lifecycle and code execution operations.
 */
@ApiTags('rooms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(IdempotencyInterceptor)
@Controller()
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post(CONTROL_API.ROOMS.CREATE.route)
  @Idempotent()
  @ApiOperation({ summary: 'Create a new room' })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'UUID for dedup to prevent duplicate rooms on network retry',
    required: false,
  })
  @ApiBody({ type: CreateRoomDto })
  @ApiResponse({
    status: 201,
    type: CreateRoomResponseDto,
    description:
      'Room created (best-effort). Check `collabCreated` and `mediaCreated` ' +
      'to see which subsystems succeeded.',
  })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation error' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({
    status: 409,
    type: ErrorResponseDto,
    description: 'Idempotency conflict. Duplicate request is being processed',
  })
  @ApiResponse({ status: 500, type: ErrorResponseDto, description: 'Internal server error' })
  async createRoom(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateRoomDto,
  ): Promise<CreateRoomResponseDto> {
    const result = await this.roomsService.createRoom(user.id, body);
    return { ...result, createdAt: result.createdAt.toISOString() };
  }

  @Get(CONTROL_API.ROOMS.LIST.route)
  @ApiOperation({ summary: 'List rooms for current user' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Page size (1-100)' })
  @ApiQuery({ name: 'status', required: false, enum: [...ROOM_STATUSES] })
  @ApiQuery({ name: 'mode', required: false, enum: [...ROOM_MODES] })
  @ApiQuery({ name: 'sortBy', required: false, enum: [...ROOMS_SORT_BY_OPTIONS] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: [...SORT_ORDER_OPTIONS] })
  @ApiResponse({ status: 200, type: ListRoomsResponseDto, description: 'Paginated list of rooms' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  async listRooms(
    @CurrentUser() user: AuthUser,
    @Query() query: ListRoomsQueryDto,
  ): Promise<ListRoomsResponseDto> {
    const result = await this.roomsService.listRooms(user.id, query);
    return {
      data: result.data.map((room) => ({
        ...room,
        createdAt: room.createdAt.toISOString(),
      })),
      pagination: result.pagination,
    };
  }

  @Get(CONTROL_API.ROOMS.GET.route)
  @ApiOperation({ summary: 'Get room details' })
  @ApiParam({ name: 'id', description: 'Room ID (UUID)' })
  @ApiResponse({ status: 200, type: RoomDetailDto, description: 'Room details' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    type: ErrorResponseDto,
    description: 'Not a participant of this room',
  })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Room not found' })
  async getRoom(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<RoomDetailDto> {
    const result = await this.roomsService.getRoom(id, user.id);
    return this.serializeRoomDetail(result);
  }

  @Post(CONTROL_API.ROOMS.JOIN.route)
  @HttpCode(200)
  @ApiOperation({ summary: 'Join a room via room code' })
  @ApiParam({ name: 'id', description: 'Room ID (UUID)' })
  @ApiBody({ type: JoinRoomDto })
  @ApiResponse({
    status: 200,
    type: JoinRoomResponseDto,
    description: 'Successfully joined the room',
  })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Invalid room code' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Room not found' })
  @ApiResponse({
    status: 409,
    type: ErrorResponseDto,
    description: 'Room full, already joined, or finished',
  })
  async joinRoom(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: JoinRoomDto,
  ): Promise<JoinRoomResponseDto> {
    const result = await this.roomsService.joinRoom(id, user.id, body);
    return {
      room: this.serializeRoomDetail(result.room),
      assignedRole: result.assignedRole,
      myCapabilities: result.myCapabilities,
      collabToken: result.collabToken,
      collabUrl: result.collabUrl,
    };
  }

  @Delete(CONTROL_API.ROOMS.DESTROY.route)
  @ApiOperation({ summary: 'Destroy a room' })
  @ApiParam({ name: 'id', description: 'Room ID', example: 'room-abc-123' })
  @ApiResponse({
    status: 200,
    type: DestroyRoomResponseDto,
    description:
      'Room destroyed (best-effort). Check `collabDeleted` and `mediaDeleted` ' +
      'to see which subsystems succeeded. May include final CRDT snapshot.',
  })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({ status: 500, type: ErrorResponseDto, description: 'Internal server error' })
  async destroyRoom(@Param('id') id: string): Promise<DestroyRoomResponseDto> {
    const result = await this.roomsService.destroyRoom(id);
    return {
      roomId: id,
      finalSnapshot: result.collab?.finalSnapshot,
      collabDeleted: result.collab !== null,
      mediaDeleted: result.mediaDeleted,
    };
  }

  @Post(CONTROL_API.ROOMS.RUN.route)
  @ApiOperation({ summary: 'Execute code once (interactive run)' })
  @ApiParam({ name: 'id', description: 'Room ID', example: 'room-abc-123' })
  @ApiBody({ type: RunCodeDto })
  @ApiResponse({ status: 201, type: RunCodeResponseDto, description: 'Code execution submitted' })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation error' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({
    status: 503,
    type: ErrorResponseDto,
    description: 'Execution service unavailable (circuit breaker open)',
  })
  @ApiResponse({
    status: 504,
    type: ErrorResponseDto,
    description: 'Execution service timeout',
  })
  @ApiResponse({ status: 500, type: ErrorResponseDto, description: 'Internal server error' })
  async runCode(@Param('id') id: string, @Body() body: RunCodeDto): Promise<RunCodeResponseDto> {
    return this.roomsService.runCode(id, body);
  }

  @Post(CONTROL_API.ROOMS.SUBMIT.route)
  @ApiOperation({ summary: 'Execute code against multiple test cases (problem submission)' })
  @ApiParam({ name: 'id', description: 'Room ID', example: 'room-abc-123' })
  @ApiBody({ type: SubmitProblemDto })
  @ApiResponse({ status: 201, type: [SubmitResultItemDto], description: 'Test cases submitted' })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation error' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({ status: 500, type: ErrorResponseDto, description: 'Internal server error' })
  async submitProblem(
    @Param('id') id: string,
    @Body() body: SubmitProblemDto,
  ): Promise<SubmitResultItemDto[]> {
    const { testCases, ...request } = body;
    return this.roomsService.submitProblem(id, request, testCases);
  }

  private serializeRoomDetail(detail: Awaited<ReturnType<RoomsService['getRoom']>>): RoomDetailDto {
    return {
      ...detail,
      participants: detail.participants.map((p) => ({
        ...p,
        joinedAt: p.joinedAt.toISOString(),
      })),
      currentPhaseStartedAt: detail.currentPhaseStartedAt?.toISOString() ?? null,
      createdAt: detail.createdAt.toISOString(),
    };
  }
}
