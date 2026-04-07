import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CONTROL_API } from '@syncode/contracts';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ErrorResponseDto } from '@/common/dto/error-response.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import type { AuthUser } from '@/modules/auth/auth.types';
import { ListBookmarksQueryDto, ListBookmarksResponseDto } from './dto/problems.dto.js';
import { ProblemsService } from './problems.service.js';

@ApiTags('Bookmarks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class BookmarksController {
  constructor(private readonly problemsService: ProblemsService) {}

  @Get(CONTROL_API.BOOKMARKS.LIST.route)
  @ApiOperation({ summary: 'List bookmarked problems' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Page size (1-100)' })
  @ApiResponse({
    status: 200,
    type: ListBookmarksResponseDto,
    description: 'Bookmarked problems',
  })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  async listBookmarks(
    @CurrentUser() user: AuthUser,
    @Query() query: ListBookmarksQueryDto,
  ): Promise<ListBookmarksResponseDto> {
    return this.problemsService.listBookmarks(user.id, query);
  }

  @Put(CONTROL_API.BOOKMARKS.ADD.route)
  @HttpCode(204)
  @ApiOperation({ summary: 'Bookmark a problem' })
  @ApiParam({ name: 'problemId', description: 'Problem ID (UUID)' })
  @ApiResponse({ status: 204, description: 'Bookmark added (idempotent)' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Problem not found' })
  async addBookmark(
    @CurrentUser() user: AuthUser,
    @Param('problemId', ParseUUIDPipe) problemId: string,
  ): Promise<void> {
    await this.problemsService.addBookmark(user.id, problemId);
  }

  @Delete(CONTROL_API.BOOKMARKS.REMOVE.route)
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove bookmark' })
  @ApiParam({ name: 'problemId', description: 'Problem ID (UUID)' })
  @ApiResponse({ status: 204, description: 'Bookmark removed (idempotent)' })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Unauthorized' })
  async removeBookmark(
    @CurrentUser() user: AuthUser,
    @Param('problemId', ParseUUIDPipe) problemId: string,
  ): Promise<void> {
    await this.problemsService.removeBookmark(user.id, problemId);
  }
}
