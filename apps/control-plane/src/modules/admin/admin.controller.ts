import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CONTROL_API } from '@syncode/contracts';
import { CurrentUser } from '@/common/decorators/current-user.decorator.js';
import { ErrorResponseDto } from '@/common/dto/error-response.dto.js';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard.js';
import { AdminService } from './admin.service.js';
import {
  AdminBanUserDto,
  AdminUserDto,
  AdminUsersQueryDto,
  AdminUsersResponseDto,
} from './dto/admin.dto.js';

@ApiTags('admin')
@Controller()
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get(CONTROL_API.ADMIN.USERS.LIST.route)
  @ApiOperation({ summary: 'List users for admin management' })
  @ApiResponse({ status: 200, type: AdminUsersResponseDto, description: 'Paginated users' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({ status: 403, type: ErrorResponseDto, description: 'Admin access required' })
  async listUsers(
    @CurrentUser() user: { id: string },
    @Query() query: AdminUsersQueryDto,
  ): Promise<AdminUsersResponseDto> {
    return this.adminService.listUsers(user.id, query);
  }

  @Patch(CONTROL_API.ADMIN.USERS.BAN.route)
  @ApiOperation({ summary: 'Ban a user account' })
  @ApiParam({ name: 'id', description: 'User ID to ban' })
  @ApiBody({ type: AdminBanUserDto })
  @ApiResponse({ status: 200, type: AdminUserDto, description: 'Banned user' })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation error' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({ status: 403, type: ErrorResponseDto, description: 'Admin access required' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'User not found' })
  async banUser(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AdminBanUserDto,
  ): Promise<AdminUserDto> {
    return this.adminService.banUser(user.id, id, body);
  }

  @Patch(CONTROL_API.ADMIN.USERS.UNBAN.route)
  @ApiOperation({ summary: 'Unban a user account' })
  @ApiParam({ name: 'id', description: 'User ID to unban' })
  @ApiResponse({ status: 200, type: AdminUserDto, description: 'Unbanned user' })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation error' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({ status: 403, type: ErrorResponseDto, description: 'Admin access required' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'User not found' })
  async unbanUser(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminUserDto> {
    return this.adminService.unbanUser(user.id, id);
  }
}
