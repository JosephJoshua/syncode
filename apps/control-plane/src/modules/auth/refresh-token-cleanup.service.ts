import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuthService } from './auth.service.js';

@Injectable()
export class RefreshTokenCleanupService {
  constructor(private readonly authService: AuthService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredRefreshTokens(): Promise<void> {
    await this.authService.cleanupExpiredRefreshTokens();
  }
}
