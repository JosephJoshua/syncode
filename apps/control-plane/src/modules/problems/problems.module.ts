import { Module } from '@nestjs/common';
import { AuditModule } from '../admin/audit.module.js';
import { BookmarksController } from './bookmarks.controller.js';
import { ProblemsController } from './problems.controller.js';
import { ProblemsService } from './problems.service.js';

@Module({
  imports: [AuditModule],
  controllers: [ProblemsController, BookmarksController],
  providers: [ProblemsService],
  exports: [ProblemsService],
})
export class ProblemsModule {}
