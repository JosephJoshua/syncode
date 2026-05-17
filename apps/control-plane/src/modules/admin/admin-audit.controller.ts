import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CONTROL_API } from '@syncode/contracts';
import { CurrentUser } from '@/common/decorators/current-user.decorator.js';
import { ErrorResponseDto } from '@/common/dto/error-response.dto.js';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard.js';
import { AuditService } from './audit.service.js';
import { AdminAuditLogsQueryDto, AdminAuditLogsResponseDto } from './dto/admin-audit.dto.js';

@ApiTags('admin')
@Controller()
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class AdminAuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get(CONTROL_API.ADMIN.AUDIT_LOGS.route)
  @ApiOperation({ summary: 'List audit logs for admin review' })
  @ApiResponse({
    status: 200,
    type: AdminAuditLogsResponseDto,
    description: 'Paginated audit logs',
  })
  @ApiQuery({ name: 'cursor', required: false, description: 'Opaque pagination cursor' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Page size' })
  @ApiQuery({ name: 'search', required: false, description: 'Search action, target, or actor' })
  @ApiQuery({ name: 'action', required: false, description: 'Filter by action' })
  @ApiQuery({
    name: 'actorId',
    required: false,
    format: 'uuid',
    description: 'Filter by actor user ID',
  })
  @ApiQuery({ name: 'targetId', required: false, description: 'Filter by target ID' })
  @ApiQuery({
    name: 'from',
    required: false,
    type: String,
    format: 'date-time',
    description: 'Created-at lower bound',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    type: String,
    format: 'date-time',
    description: 'Created-at upper bound',
  })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation error' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({ status: 403, type: ErrorResponseDto, description: 'Admin access required' })
  async listAuditLogs(
    @CurrentUser() user: { id: string },
    @Query() query: AdminAuditLogsQueryDto,
  ): Promise<AdminAuditLogsResponseDto> {
    return this.auditService.listLogs(user.id, query);
  }
}
