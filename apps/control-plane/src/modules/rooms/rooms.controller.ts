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
import {
  BROWSEABLE_ROOM_STATUSES,
  CONTROL_API,
  ROOMS_SORT_BY_OPTIONS,
  SORT_ORDER_OPTIONS,
} from '@syncode/contracts';
import {
  PROBLEM_DIFFICULTIES,
  ROOM_MODES,
  ROOM_STATUSES,
  SUPPORTED_LANGUAGES,
} from '@syncode/shared';
import { CurrentUser } from '@/common/decorators/current-user.decorator.js';
import { Idempotent } from '@/common/decorators/idempotent.decorator.js';
import { ErrorResponseDto } from '@/common/dto/error-response.dto.js';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard.js';
import { IdempotencyInterceptor } from '@/common/interceptors/idempotency.interceptor.js';
import type { AuthUser } from '@/modules/auth/auth.types.js';
import {
  BrowseRoomsQueryDto,
  BrowseRoomsResponseDto,
  ChangeRoomLanguageDto,
  CreateRoomDto,
  CreateRoomResponseDto,
  DestroyRoomResponseDto,
  EnsureCollabResponseDto,
  JoinRoomDto,
  JoinRoomResponseDto,
  ListRoomsQueryDto,
  ListRoomsResponseDto,
  MediaTokenResponseDto,
  RequestRoomAiHintDto,
  RequestRoomAiHintResponseDto,
  RoomChatMediaUploadDto,
  RoomChatMediaUploadResponseDto,
  RoomDetailDto,
  RunCodeDto,
  RunCodeResponseDto,
  SubmitCodeResponseDto,
  SubmitProblemDto,
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

  @Get(CONTROL_API.ROOMS.BROWSE_PUBLIC.route)
  @ApiOperation({ summary: 'Browse public rooms with filters' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Page size (1-100)' })
  @ApiQuery({ name: 'status', required: false, enum: [...BROWSEABLE_ROOM_STATUSES] })
  @ApiQuery({ name: 'language', required: false, enum: [...SUPPORTED_LANGUAGES] })
  @ApiQuery({ name: 'difficulty', required: false, enum: [...PROBLEM_DIFFICULTIES] })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, type: BrowseRoomsResponseDto })
  async browsePublicRooms(
    @CurrentUser() user: AuthUser,
    @Query() query: BrowseRoomsQueryDto,
  ): Promise<BrowseRoomsResponseDto> {
    const result = await this.roomsService.browsePublicRooms(user.id, query);
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

  @Delete(CONTROL_API.ROOMS.REMOVE_PARTICIPANT.route)
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a participant from the room (host only)' })
  @ApiParam({ name: 'id', description: 'Room ID (UUID)' })
  @ApiParam({ name: 'userId', description: 'Target participant user ID (UUID)' })
  @ApiResponse({ status: 204, description: 'Participant removed' })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Cannot remove yourself',
  })
  @ApiResponse({
    status: 403,
    type: ErrorResponseDto,
    description: 'Requester is not the host',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description: 'Room or participant not found',
  })
  async removeParticipant(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    await this.roomsService.removeParticipant(id, user.id, userId);
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
  @HttpCode(202)
  @ApiOperation({ summary: 'Execute code once (interactive run)' })
  @ApiParam({ name: 'id', description: 'Room ID (UUID)' })
  @ApiBody({ type: RunCodeDto })
  @ApiResponse({ status: 202, type: RunCodeResponseDto, description: 'Code execution accepted' })
  @ApiResponse({ status: 403, type: ErrorResponseDto, description: 'Permission denied' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Room not found' })
  @ApiResponse({ status: 409, type: ErrorResponseDto, description: 'Editor is locked' })
  @ApiResponse({
    status: 503,
    type: ErrorResponseDto,
    description: 'Execution service unavailable',
  })
  @ApiResponse({ status: 504, type: ErrorResponseDto, description: 'Execution service timeout' })
  async runCode(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: RunCodeDto,
  ): Promise<RunCodeResponseDto> {
    return this.roomsService.runCode(id, user.id, body);
  }

  @Post(CONTROL_API.ROOMS.SUBMIT.route)
  @HttpCode(202)
  @ApiOperation({ summary: 'Submit code against problem test cases' })
  @ApiParam({ name: 'id', description: 'Room ID (UUID)' })
  @ApiBody({ type: SubmitProblemDto })
  @ApiResponse({ status: 202, type: SubmitCodeResponseDto, description: 'Submission accepted' })
  @ApiResponse({ status: 403, type: ErrorResponseDto, description: 'Permission denied' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Room or problem not found' })
  @ApiResponse({ status: 409, type: ErrorResponseDto, description: 'Editor is locked' })
  async submitProblem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: SubmitProblemDto,
  ): Promise<SubmitCodeResponseDto> {
    return this.roomsService.submitProblem(id, user.id, body);
  }

  @Post(CONTROL_API.ROOMS.AI_HINT.route)
  @HttpCode(202)
  @ApiOperation({ summary: 'Request AI hint for current code' })
  @ApiParam({ name: 'id', description: 'Room ID (UUID)' })
  @ApiBody({ type: RequestRoomAiHintDto })
  @ApiResponse({
    status: 202,
    type: RequestRoomAiHintResponseDto,
    description: 'Hint request accepted',
  })
  @ApiResponse({
    status: 403,
    type: ErrorResponseDto,
    description: 'No ai:request-hint capability',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description: 'No problem selected in room',
  })
  @ApiResponse({
    status: 429,
    type: ErrorResponseDto,
    description: 'Hint rate limit exceeded (3 per 5 minutes)',
  })
  @ApiResponse({
    status: 503,
    type: ErrorResponseDto,
    description: 'AI service unavailable',
  })
  async requestAiHint(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: RequestRoomAiHintDto,
  ): Promise<RequestRoomAiHintResponseDto> {
    return this.roomsService.requestAiHint(id, user.id, body);
  }

  @Post(CONTROL_API.ROOMS.CHAT_MEDIA_UPLOAD_URL.route)
  @HttpCode(201)
  @ApiOperation({ summary: 'Get presigned upload URL for room chat media' })
  @ApiParam({ name: 'id', description: 'Room ID (UUID)' })
  @ApiBody({ type: RoomChatMediaUploadDto })
  @ApiResponse({
    status: 201,
    type: RoomChatMediaUploadResponseDto,
    description: 'Presigned upload URL and media metadata',
  })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Unsupported file type or file too large',
  })
  @ApiResponse({
    status: 403,
    type: ErrorResponseDto,
    description: 'Not a participant or lacks chat capability',
  })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Room not found' })
  async getChatMediaUploadUrl(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: RoomChatMediaUploadDto,
  ): Promise<RoomChatMediaUploadResponseDto> {
    return this.roomsService.getRoomChatMediaUploadUrl(id, user.id, body);
  }

  @Post(CONTROL_API.ROOMS.TOGGLE_READY.route)
  @HttpCode(200)
  @ApiOperation({ summary: 'Toggle ready status' })
  @ApiParam({ name: 'id', description: 'Room ID (UUID)' })
  @ApiResponse({ status: 200, type: RoomDetailDto })
  async toggleReady(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<RoomDetailDto> {
    const result = await this.roomsService.toggleReady(id, user.id);
    return this.serializeRoomDetail(result);
  }

  @Patch(CONTROL_API.ROOMS.CHANGE_LANGUAGE.route)
  @HttpCode(200)
  @ApiOperation({ summary: 'Change the active programming language for a room' })
  @ApiParam({ name: 'id', description: 'Room ID (UUID)' })
  @ApiBody({ type: ChangeRoomLanguageDto })
  @ApiResponse({ status: 200, type: RoomDetailDto })
  @ApiResponse({ status: 400, type: ErrorResponseDto })
  @ApiResponse({ status: 403, type: ErrorResponseDto })
  @ApiResponse({ status: 404, type: ErrorResponseDto })
  async changeLanguage(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: ChangeRoomLanguageDto,
  ): Promise<RoomDetailDto> {
    const result = await this.roomsService.changeLanguage(id, user.id, body.language);
    return this.serializeRoomDetail(result);
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

  @Post(CONTROL_API.ROOMS.ENSURE_COLLAB.route)
  @HttpCode(200)
  @ApiOperation({ summary: 'Recreate the collab document if it was torn down' })
  @ApiParam({ name: 'id', description: 'Room ID (UUID)' })
  @ApiResponse({
    status: 200,
    type: EnsureCollabResponseDto,
    description:
      'Collab doc exists (either already running or recreated from the latest stored snapshot)',
  })
  @ApiResponse({ status: 403, type: ErrorResponseDto, description: 'Not a participant' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Room not found' })
  @ApiResponse({ status: 409, type: ErrorResponseDto, description: 'Room has already finished' })
  @ApiResponse({
    status: 503,
    type: ErrorResponseDto,
    description: 'Collab plane is unavailable',
  })
  async ensureCollab(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<EnsureCollabResponseDto> {
    return this.roomsService.ensureCollab(id, user.id);
  }

  @Post(CONTROL_API.ROOMS.MEDIA_TOKEN.route)
  @HttpCode(200)
  @ApiOperation({ summary: 'Generate LiveKit access token' })
  @ApiParam({ name: 'id', description: 'Room ID (UUID)' })
  @ApiResponse({ status: 200, type: MediaTokenResponseDto, description: 'Token generated' })
  @ApiResponse({
    status: 403,
    type: ErrorResponseDto,
    description: 'Not a participant or lacks media capability',
  })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Room not found' })
  @ApiResponse({
    status: 503,
    type: ErrorResponseDto,
    description: 'Media service unavailable',
  })
  @ApiResponse({ status: 504, type: ErrorResponseDto, description: 'Media service timeout' })
  async generateMediaToken(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<MediaTokenResponseDto> {
    const result = await this.roomsService.generateMediaToken(id, user.id);
    return { ...result, expiresAt: result.expiresAt.toISOString() };
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
