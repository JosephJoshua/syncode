import { Module } from '@nestjs/common';
import { BookmarksController } from './bookmarks.controller.js';
import { ProblemsController } from './problems.controller.js';
import { ProblemsService } from './problems.service.js';

@Module({
  controllers: [ProblemsController, BookmarksController],
  providers: [ProblemsService],
  exports: [ProblemsService],
})
export class ProblemsModule {}
