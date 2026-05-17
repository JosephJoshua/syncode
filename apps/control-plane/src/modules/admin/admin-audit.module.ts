import { Module } from '@nestjs/common';
import { AdminAuditController } from './admin-audit.controller.js';
import { AuditModule } from './audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [AdminAuditController],
})
export class AdminAuditModule {}
