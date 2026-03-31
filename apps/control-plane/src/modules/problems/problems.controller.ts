import {
  Controller,
  Delete,
  Get,
  NotImplementedException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CONTROL_API } from '@syncode/contracts';
import { ErrorResponseDto } from '@/common/dto/error-response.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { ProblemsService } from './problems.service.js';

/**
 * TODO: Implement problem endpoints:
 * - GET /problems: List all problems
 * - GET /problems/:id: Get problem details
 * - POST /problems: Create problem (admin only)
 * - PATCH /problems/:id: Update problem (admin only)
 * - DELETE /problems/:id: Delete problem (admin only)
 * - GET /problems/:id/test-cases: Get test cases
 * - POST /problems/:id/submit: Submit solution
 */
@ApiTags('problems')
@Controller()
export class ProblemsController {
  constructor(private readonly problemsService: ProblemsService) {}

  @Get(CONTROL_API.PROBLEMS.LIST.route)
  @ApiOperation({
    summary: 'List all problems (TODO)',
    description: 'Not yet implemented.',
  })
  @ApiResponse({ status: 200, description: 'List of problems (schema TBD)' })
  @ApiResponse({ status: 500, type: ErrorResponseDto, description: 'Internal server error' })
  async listProblems() {
    return this.problemsService.findAll();
  }

  @Get(CONTROL_API.PROBLEMS.GET_BY_ID.route)
  @ApiOperation({
    summary: 'Get problem by ID (TODO)',
    description: 'Not yet implemented.',
  })
  @ApiParam({ name: 'id', description: 'Problem ID', example: 'two-sum' })
  @ApiResponse({ status: 200, description: 'Problem details (schema TBD)' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Problem not found' })
  @ApiResponse({ status: 500, type: ErrorResponseDto, description: 'Internal server error' })
  async getProblem(@Param('id') id: string) {
    return this.problemsService.findById(id);
  }

  @Post(CONTROL_API.PROBLEMS.CREATE.route)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create new problem (TODO, admin only)',
    description: 'Not yet implemented.',
  })
  @ApiResponse({ status: 201, description: 'Problem created (schema TBD)' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({ status: 500, type: ErrorResponseDto, description: 'Internal server error' })
  async createProblem() {
    // TODO: Implement problem creation
    throw new NotImplementedException();
  }

  @Delete(CONTROL_API.PROBLEMS.DELETE.route)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete problem (TODO, admin only)' })
  @ApiParam({ name: 'id', description: 'Problem ID', example: 'two-sum' })
  @ApiResponse({ status: 200, description: 'Problem deleted (empty response body)' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Problem not found' })
  @ApiResponse({ status: 500, type: ErrorResponseDto, description: 'Internal server error' })
  async deleteProblem(@Param('id') id: string) {
    return this.problemsService.delete(id);
  }
}
