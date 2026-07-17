import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { AuditModule } from './audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
