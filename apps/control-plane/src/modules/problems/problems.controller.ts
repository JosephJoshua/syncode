import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CONTROL_API, SORT_ORDER_OPTIONS } from '@syncode/contracts';
import { PROBLEM_DIFFICULTIES, PROBLEMS_SORT_BY_OPTIONS } from '@syncode/shared';
import { CurrentUser } from '@/common/decorators/current-user.decorator.js';
import { ErrorResponseDto } from '@/common/dto/error-response.dto.js';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard.js';
import type { AuthUser } from '@/modules/auth/auth.types.js';
import {
  ProblemDetailDto,
  ProblemsListQueryDto,
  ProblemsListResponseDto,
  ProblemsTagsResponseDto,
} from './dto/problems.dto.js';
import { ProblemsService } from './problems.service.js';

@ApiTags('problems')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ProblemsController {
  constructor(private readonly problemsService: ProblemsService) {}

  @Get(CONTROL_API.PROBLEMS.LIST.route)
  @ApiOperation({ summary: 'List problems' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Page size (1-100)' })
  @ApiQuery({
    name: 'difficulty',
    required: false,
    enum: [...PROBLEM_DIFFICULTIES],
    description: 'Filter by difficulty',
  })
  @ApiQuery({
    name: 'tags',
    required: false,
    description: 'Comma-separated tag slugs',
  })
  @ApiQuery({ name: 'company', required: false, description: 'Company slug filter' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Full-text search on title and description',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: [...PROBLEMS_SORT_BY_OPTIONS],
    description: 'Sort field',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: [...SORT_ORDER_OPTIONS],
    description: 'Sort direction',
  })
  @ApiResponse({
    status: 200,
    type: ProblemsListResponseDto,
    description: 'Paginated list of problems',
  })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  async listProblems(
    @CurrentUser() user: AuthUser,
    @Query() query: ProblemsListQueryDto,
  ): Promise<ProblemsListResponseDto> {
    return this.problemsService.listProblems(user.id, query);
  }

  // /problems/tags MUST be registered before /problems/:id
  // to prevent NestJS from matching "tags" as an :id parameter.
  @Get(CONTROL_API.PROBLEMS.TAGS.route)
  @ApiOperation({ summary: 'List all tags' })
  @ApiResponse({
    status: 200,
    type: ProblemsTagsResponseDto,
    description: 'List of tags',
  })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  async listTags(): Promise<ProblemsTagsResponseDto> {
    return this.problemsService.listTags();
  }

  @Get(CONTROL_API.PROBLEMS.GET_BY_ID.route)
  @ApiOperation({ summary: 'Get problem details by ID' })
  @ApiParam({ name: 'id', description: 'Problem ID (UUID)' })
  @ApiResponse({ status: 200, type: ProblemDetailDto, description: 'Problem details' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Problem not found' })
  async getProblem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<ProblemDetailDto> {
    return this.problemsService.findById(user.id, id);
  }
}
