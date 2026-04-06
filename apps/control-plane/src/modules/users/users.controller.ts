import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ErrorResponseDto } from '@/common/dto/error-response.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import {
  PublicUserProfileResponseDto,
  UpdateUserDto,
  UserProfileResponseDto,
  UserQuotasResponseDto,
} from './dto/user.dto.js';
import { UsersService } from './users.service.js';

/**
 * User management endpoints.
 *
 * Remaining TODO:
 * - GET /users/me/rooms
 */
@ApiTags('users')
@Controller()
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(CONTROL_API.USERS.PROFILE.route)
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, type: UserProfileResponseDto, description: 'Current user profile' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({ status: 500, type: ErrorResponseDto, description: 'Internal server error' })
  async getCurrentUser(@CurrentUser() user: { id: string }): Promise<UserProfileResponseDto> {
    return this.usersService.findById(user.id);
  }

  @Get(CONTROL_API.USERS.QUOTAS.route)
  @ApiOperation({ summary: 'Get current user usage quotas' })
  @ApiResponse({ status: 200, type: UserQuotasResponseDto, description: 'Current usage quotas' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({ status: 500, type: ErrorResponseDto, description: 'Internal server error' })
  async getCurrentUserQuotas(@CurrentUser() user: { id: string }): Promise<UserQuotasResponseDto> {
    return this.usersService.getQuotas(user.id);
  }

  @Get(CONTROL_API.USERS.GET_BY_ID.route)
  @ApiOperation({ summary: 'Get public user profile by ID' })
  @ApiParam({
    name: 'id',
    description: 'User ID',
    example: '497f6eca-6276-4993-bfeb-53cbbbba6f08',
  })
  @ApiResponse({
    status: 200,
    type: PublicUserProfileResponseDto,
    description: 'Public user profile',
  })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'User not found' })
  @ApiResponse({ status: 500, type: ErrorResponseDto, description: 'Internal server error' })
  async getUserById(@Param('id') id: string): Promise<PublicUserProfileResponseDto> {
    return this.usersService.findPublicById(id);
  }

  @Patch(CONTROL_API.USERS.UPDATE.route)
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({ status: 200, type: UserProfileResponseDto, description: 'Updated user profile' })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation error' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({ status: 409, type: ErrorResponseDto, description: 'Username taken' })
  @ApiResponse({ status: 500, type: ErrorResponseDto, description: 'Internal server error' })
  async updateCurrentUser(
    @CurrentUser() user: { id: string },
    @Body() body: UpdateUserDto,
  ): Promise<UserProfileResponseDto> {
    return this.usersService.update(user.id, body);
  }

  @Delete(CONTROL_API.USERS.DELETE.route)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete current user account' })
  @ApiResponse({ status: 204, description: 'Account soft-deleted' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({ status: 500, type: ErrorResponseDto, description: 'Internal server error' })
  async deleteCurrentUser(@CurrentUser() user: { id: string }): Promise<void> {
    await this.usersService.delete(user.id);
  }
}
