import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import {
  AI_CLIENT,
  COLLAB_CLIENT,
  CONTROL_API,
  EXECUTION_CLIENT,
  type IAiClient,
  type ICollabClient,
  type IExecutionClient,
  type ServiceStatuses,
} from '@syncode/contracts';
import {
  CACHE_SERVICE,
  type ICacheService,
  type IQueueService,
  type IStorageService,
  QUEUE_SERVICE,
  STORAGE_SERVICE,
} from '@syncode/shared/ports';
import { HealthCheckResponseDto } from './common/dto/health.dto';

/**
 * Provides application-level endpoints.
 */
@SkipThrottle()
@ApiTags('health')
@Controller()
export class AppController {
  constructor(
    @Inject(QUEUE_SERVICE) private readonly queueService: IQueueService,
    @Inject(CACHE_SERVICE) private readonly cacheService: ICacheService,
    @Inject(STORAGE_SERVICE) private readonly storageService: IStorageService,
    @Inject(EXECUTION_CLIENT) private readonly executionClient: IExecutionClient,
    @Inject(AI_CLIENT) private readonly aiClient: IAiClient,
    @Inject(COLLAB_CLIENT) private readonly collabClient: ICollabClient,
  ) {}

  @Get(CONTROL_API.HEALTH.route)
  @ApiOperation({ summary: 'Health check with deep service connectivity checks' })
  @ApiResponse({
    status: 200,
    type: HealthCheckResponseDto,
    description:
      'Always returns 200. Check `status` field for overall health and `services` for per-service breakdown.',
  })
  async healthCheck(): Promise<HealthCheckResponseDto> {
    const services: ServiceStatuses = {
      queue: 'fail',
      cache: 'fail',
      storage: 'fail',
      execution: 'fail',
      ai: 'fail',
      collab: 'fail',
    };

    try {
      await this.queueService.getQueueStats('health-check-queue');
      services.queue = 'ok';
    } catch {}

    try {
      await this.cacheService.exists('health-check-key');
      services.cache = 'ok';
    } catch {}

    try {
      await this.storageService.exists('health-check-key');
      services.storage = 'ok';
    } catch {}

    try {
      if (await this.executionClient.healthCheck()) services.execution = 'ok';
    } catch {}

    try {
      if (await this.aiClient.healthCheck()) services.ai = 'ok';
    } catch {}

    try {
      if (await this.collabClient.healthCheck()) services.collab = 'ok';
    } catch {}

    const allHealthy = Object.values(services).every((s) => s === 'ok');

    return {
      status: allHealthy ? 'ok' : 'degraded',
      services,
      timestamp: new Date().toISOString(),
    };
  }
}
