import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { CONTROL_API } from '@syncode/contracts';
import { CurrentUser } from '@/common/decorators/current-user.decorator.js';
import { ErrorResponseDto } from '@/common/dto/error-response.dto.js';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard.js';
import type { AuthUser } from '@/modules/auth/auth.types.js';
import {
  ExecutionDetailsResponseDto,
  ExecutionResultResponseDto,
  JobStatusResponseDto,
  StaticAnalysisResultResponseDto,
} from './dto/execution.dto.js';
import { ExecutionService } from './execution.service.js';

/**
 * Provides endpoints for polling code execution results.
 */
@ApiTags('execution')
@ApiBearerAuth()
@ApiExtraModels(ExecutionResultResponseDto, JobStatusResponseDto)
@UseGuards(JwtAuthGuard)
@Controller()
export class ExecutionController {
  constructor(private readonly executionService: ExecutionService) {}

  @Get(CONTROL_API.EXECUTION.GET_SUBMISSION_DETAILS.route)
  @ApiOperation({
    summary: 'Get detailed execution results for a submission',
    description:
      'Returns submission-level execution details with per-test-case expected/actual output, ' +
      'timing, memory, and logs for rendering detailed result panels.',
  })
  @ApiParam({
    name: 'submissionId',
    description: 'Submission ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    type: ExecutionDetailsResponseDto,
    description: 'Detailed execution result payload for the submission',
  })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Submission not found' })
  async getSubmissionDetails(
    @Param('submissionId') submissionId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ExecutionDetailsResponseDto> {
    const result = await this.executionService.getSubmissionDetails(submissionId, user.id);
    return {
      ...result,
      submittedAt: result.submittedAt.toISOString(),
      completedAt: result.completedAt?.toISOString() ?? null,
    };
  }

  @Get(CONTROL_API.EXECUTION.GET_RESULT.route)
  @SkipThrottle()
  @ApiOperation({
    summary: 'Get execution result by job ID',
    description:
      'Returns the full `ExecutionResultResponse` when the job has completed or failed, ' +
      'or a `JobStatusResponse` with just the status while the job is still queued/running. ' +
      'Frontend should poll this endpoint and check for the presence of `stdout` to distinguish the two shapes.',
  })
  @ApiParam({ name: 'jobId', description: 'Execution job ID', example: 'exec-job-abc-123' })
  @ApiResponse({
    status: 200,
    description:
      'Full execution result (when completed/failed) or job status (when queued/running)',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(ExecutionResultResponseDto) },
        { $ref: getSchemaPath(JobStatusResponseDto) },
      ],
    },
  })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Execution job not found' })
  @ApiResponse({
    status: 503,
    type: ErrorResponseDto,
    description: 'Execution service unavailable (circuit breaker open)',
  })
  @ApiResponse({ status: 504, type: ErrorResponseDto, description: 'Execution service timeout' })
  async getExecutionResult(
    @Param('jobId') jobId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ExecutionResultResponseDto | JobStatusResponseDto> {
    return this.executionService.getExecutionResult(jobId, user.id);
  }

  @Get(CONTROL_API.EXECUTION.GET_STATUS.route)
  @ApiOperation({ summary: 'Get execution job status' })
  @ApiParam({ name: 'jobId', description: 'Execution job ID', example: 'exec-job-abc-123' })
  @ApiResponse({ status: 200, type: JobStatusResponseDto, description: 'Job status' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Execution job not found' })
  @ApiResponse({
    status: 503,
    type: ErrorResponseDto,
    description: 'Execution service unavailable (circuit breaker open)',
  })
  @ApiResponse({ status: 504, type: ErrorResponseDto, description: 'Execution service timeout' })
  async getExecutionStatus(
    @Param('jobId') jobId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<JobStatusResponseDto> {
    return this.executionService.getExecutionStatus(jobId, user.id);
  }

  @Get(CONTROL_API.EXECUTION.GET_STATIC_ANALYSIS.route)
  @SkipThrottle()
  @ApiOperation({
    summary: 'Get static analysis result by job ID',
    description:
      'Returns pending while analysis is queued/running, then returns lint, complexity, ' +
      'duplication, and tool status details once the worker result has been persisted.',
  })
  @ApiParam({
    name: 'jobId',
    description: 'Static analysis job ID',
    example: 'static-analysis-job-abc-123',
  })
  @ApiResponse({
    status: 200,
    type: StaticAnalysisResultResponseDto,
    description: 'Static analysis status or completed result payload',
  })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Static analysis not found' })
  async getStaticAnalysisResult(
    @Param('jobId') jobId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<StaticAnalysisResultResponseDto> {
    return this.executionService.getStaticAnalysisResult(jobId, user.id);
  }
}
