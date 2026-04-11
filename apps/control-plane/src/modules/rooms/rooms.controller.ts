import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
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
import { SkipThrottle } from '@nestjs/throttler';
import { CONTROL_API, ROOMS_SORT_BY_OPTIONS, SORT_ORDER_OPTIONS } from '@syncode/contracts';
import { ROOM_MODES, ROOM_STATUSES } from '@syncode/shared';
import { CurrentUser } from '@/common/decorators/current-user.decorator.js';
import { Idempotent } from '@/common/decorators/idempotent.decorator.js';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard.js';
import { IdempotencyInterceptor } from '@/common/interceptors/idempotency.interceptor.js';
import type { AuthUser } from '@/modules/auth/auth.types.js';
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
  TransferRoomOwnershipDto,
  TransferRoomOwnershipResponseDto,
  TransitionRoomPhaseDto,
  TransitionRoomPhaseResponseDto,
  UpdateRoomParticipantDto,
  UpdateRoomParticipantResponseDto,
} from './dto/rooms.dto.js';
import { RoomsService } from './rooms.service.js';

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
      'Room created (best-effort). Check `collabCreated` and `mediaCreated` to see which subsystems succeeded.',
  })
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
  @ApiResponse({ status: 200, type: ListRoomsResponseDto })
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
  @SkipThrottle()
  @ApiOperation({ summary: 'Get room details' })
  @ApiParam({ name: 'id', description: 'Room ID (UUID)' })
  @ApiResponse({ status: 200, type: RoomDetailDto })
  async getRoom(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<RoomDetailDto> {
    const result = await this.roomsService.getRoom(id, user.id);
    return this.serializeRoomDetail(result);
  }

  @Post(CONTROL_API.ROOMS.JOIN.route)
  @HttpCode(200)
  @ApiOperation({ summary: 'Join a room via room code' })
  @ApiParam({ name: 'id', description: 'Room ID (UUID)' })
  @ApiBody({ type: JoinRoomDto })
  @ApiResponse({ status: 200, type: JoinRoomResponseDto })
  async joinRoom(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: JoinRoomDto,
  ): Promise<JoinRoomResponseDto> {
    const result = await this.roomsService.joinRoom(id, user.id, body);
    return {
      room: this.serializeRoomDetail(result.room),
      assignedRole: result.assignedRole,
      requestedRole: result.requestedRole,
      assignmentReason: result.assignmentReason,
      myCapabilities: result.myCapabilities,
      collabToken: result.collabToken,
      collabUrl: result.collabUrl,
    };
  }

  @Post(CONTROL_API.ROOMS.TRANSFER_OWNERSHIP.route)
  @HttpCode(200)
  @ApiOperation({ summary: 'Transfer room ownership to another active participant' })
  @ApiParam({ name: 'id', description: 'Room ID (UUID)' })
  @ApiBody({ type: TransferRoomOwnershipDto })
  @ApiResponse({ status: 200, type: TransferRoomOwnershipResponseDto })
  async transferOwnership(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: TransferRoomOwnershipDto,
  ): Promise<TransferRoomOwnershipResponseDto> {
    const result = await this.roomsService.transferOwnership(id, user.id, body.targetUserId);
    return { ...result, transferredAt: result.transferredAt.toISOString() };
  }

  @Patch(CONTROL_API.ROOMS.UPDATE_PARTICIPANT.route)
  @HttpCode(200)
  @ApiOperation({ summary: 'Update an active participant role' })
  @ApiParam({ name: 'id', description: 'Room ID (UUID)' })
  @ApiParam({ name: 'participantUserId', description: 'Participant user ID (UUID)' })
  @ApiBody({ type: UpdateRoomParticipantDto })
  @ApiResponse({ status: 200, type: UpdateRoomParticipantResponseDto })
  async updateParticipantRole(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('participantUserId') participantUserId: string,
    @Body() body: UpdateRoomParticipantDto,
  ): Promise<UpdateRoomParticipantResponseDto> {
    const result = await this.roomsService.updateParticipantRole(
      id,
      user.id,
      participantUserId,
      body.role,
    );

    return {
      ...result,
      room: this.serializeRoomDetail(result.room),
      updatedAt: result.updatedAt.toISOString(),
    };
  }

  @Delete(CONTROL_API.ROOMS.DESTROY.route)
  @ApiOperation({ summary: 'Destroy a room' })
  @ApiParam({ name: 'id', description: 'Room ID (UUID)' })
  @ApiResponse({ status: 200, type: DestroyRoomResponseDto })
  async destroyRoom(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<DestroyRoomResponseDto> {
    const result = await this.roomsService.destroyRoom(id, user.id);
    return {
      roomId: id,
      finalSnapshot: result.collab?.finalSnapshot,
      collabDeleted: result.collab !== null,
      mediaDeleted: result.mediaDeleted,
    };
  }

  @Post(CONTROL_API.ROOMS.RUN.route)
  @ApiOperation({ summary: 'Execute code once (interactive run)' })
  @ApiParam({ name: 'id', description: 'Room ID (UUID)' })
  @ApiBody({ type: RunCodeDto })
  @ApiResponse({ status: 201, type: RunCodeResponseDto })
  async runCode(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: RunCodeDto,
  ): Promise<RunCodeResponseDto> {
    return this.roomsService.runCode(id, user.id, body);
  }

  @Post(CONTROL_API.ROOMS.SUBMIT.route)
  @ApiOperation({ summary: 'Execute code against multiple test cases' })
  @ApiParam({ name: 'id', description: 'Room ID (UUID)' })
  @ApiBody({ type: SubmitProblemDto })
  @ApiResponse({ status: 201, type: [SubmitResultItemDto] })
  async submitProblem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: SubmitProblemDto,
  ): Promise<SubmitResultItemDto[]> {
    const { testCases, ...request } = body;
    return this.roomsService.submitProblem(id, user.id, request, testCases);
  }

  @Post(CONTROL_API.ROOMS.TRANSITION_PHASE.route)
  @HttpCode(200)
  @ApiOperation({ summary: 'Transition the room stage' })
  @ApiParam({ name: 'id', description: 'Room ID (UUID)' })
  @ApiBody({ type: TransitionRoomPhaseDto })
  @ApiResponse({ status: 200, type: TransitionRoomPhaseResponseDto })
  async transitionPhase(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: TransitionRoomPhaseDto,
  ): Promise<TransitionRoomPhaseResponseDto> {
    const result = await this.roomsService.transitionPhase(id, user.id, body.targetStatus);
    return { ...result, transitionedAt: result.transitionedAt.toISOString() };
  }

  private serializeRoomDetail(detail: Awaited<ReturnType<RoomsService['getRoom']>>): RoomDetailDto {
    return {
      ...detail,
      participants: detail.participants.map((participant) => ({
        ...participant,
        joinedAt: participant.joinedAt.toISOString(),
      })),
      currentPhaseStartedAt: detail.currentPhaseStartedAt?.toISOString() ?? null,
      createdAt: detail.createdAt.toISOString(),
    };
  }
}
