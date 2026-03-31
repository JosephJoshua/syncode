import { Body, Controller, Delete, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CONTROL_API } from '@syncode/contracts';
import { ErrorResponseDto } from '@/common/dto/error-response.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import {
  CreateRoomDto,
  CreateRoomResponseDto,
  DestroyRoomResponseDto,
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
@Controller()
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post(CONTROL_API.ROOMS.CREATE.route)
  @ApiOperation({ summary: 'Create a new room' })
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
  @ApiResponse({ status: 500, type: ErrorResponseDto, description: 'Internal server error' })
  async createRoom(@Body() body: CreateRoomDto): Promise<CreateRoomResponseDto> {
    const result = await this.roomsService.createRoom(body.roomId, body.initialContent);
    return {
      roomId: body.roomId,
      createdAt: result.collab?.createdAt ?? Date.now(),
      collabCreated: result.collab !== null,
      mediaCreated: result.mediaCreated,
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
}
