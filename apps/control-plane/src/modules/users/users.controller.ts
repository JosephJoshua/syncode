import {
  Body,
  Controller,
  Delete,
  Get,
  NotImplementedException,
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
import { UpdateUserDto, UserProfileResponseDto } from './dto/user.dto';
import { UsersService } from './users.service';

/**
 * User management endpoints.
 *
 * Remaining TODO:
 * - PATCH /users/me
 * - DELETE /users/me
 * - GET /users/me/rooms
 */
@ApiTags('users')
@ApiBearerAuth()
@Controller()
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

  @Get(CONTROL_API.USERS.GET_BY_ID.route)
  @ApiOperation({ summary: 'Get user by ID (TODO)' })
  @ApiParam({ name: 'id', description: 'User ID', example: 'clx1a2b3c' })
  @ApiResponse({ status: 200, type: UserProfileResponseDto, description: 'User profile' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'User not found' })
  @ApiResponse({ status: 500, type: ErrorResponseDto, description: 'Internal server error' })
  async getUserById(@Param('id') id: string): Promise<UserProfileResponseDto> {
    return this.usersService.findById(id);
  }

  @Patch(CONTROL_API.USERS.UPDATE.route)
  @ApiOperation({ summary: 'Update current user profile (TODO)' })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({ status: 200, type: UserProfileResponseDto, description: 'Updated user profile' })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation error' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({ status: 500, type: ErrorResponseDto, description: 'Internal server error' })
  async updateCurrentUser(@Body() _body: UpdateUserDto): Promise<UserProfileResponseDto> {
    // TODO: Update current user
    throw new NotImplementedException();
  }

  @Delete(CONTROL_API.USERS.DELETE.route)
  @ApiOperation({ summary: 'Delete current user account (TODO)' })
  @ApiResponse({ status: 200, description: 'User account deleted (empty response body)' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({ status: 500, type: ErrorResponseDto, description: 'Internal server error' })
  async deleteCurrentUser(): Promise<void> {
    // TODO: Delete current user
    throw new NotImplementedException();
  }
}
