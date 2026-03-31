import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_CLIENT, COLLAB_CLIENT, EXECUTION_CLIENT } from '@syncode/contracts';
import { StubAiClient, StubCollabClient, StubExecutionClient } from '@syncode/contracts/stubs';
import {
  BullMqAdapter,
  CircuitBreakerAdapter,
  CircuitBreakerModule,
  createProtectedBullMqAdapter,
  createProtectedCollabClient,
  createProtectedLiveKitAdapter,
  createProtectedRedisAdapter,
  createProtectedS3Adapter,
  LiveKitAdapter,
  type LiveKitConfig,
  RedisCacheAdapter,
  type RedisConfig,
  type S3Config,
  S3StorageAdapter,
} from '@syncode/infrastructure';
import {
  CACHE_SERVICE,
  type ICacheService,
  type IQueueService,
  MEDIA_SERVICE,
  QUEUE_SERVICE,
  STORAGE_SERVICE,
} from '@syncode/shared/ports';
import type { EnvConfig } from '@/config/env.config';
import { HttpCollabClient } from './clients/http-collab.client';
import { QueueAiClient } from './clients/queue-ai.client';
import { QueueExecutionClient } from './clients/queue-execution.client';

/**
 * THE SINGLE SOURCE OF TRUTH for all adapter bindings in the control plane.
 */
@Global()
@Module({
  imports: [CircuitBreakerModule],
  providers: [
    {
      provide: QUEUE_SERVICE,
      useFactory: (config: ConfigService<EnvConfig>, circuitBreaker: CircuitBreakerAdapter) => {
        const redisUrl = config.get('REDIS_URL', { infer: true })!;
        const redisConfig: RedisConfig = {
          url: redisUrl,
          connectTimeout: 10 * 1_000,
          commandTimeout: 5 * 1_000,
        };

        const adapter = new BullMqAdapter(redisConfig);
        return createProtectedBullMqAdapter(adapter, circuitBreaker);
      },
      inject: [ConfigService, CircuitBreakerAdapter],
    },
    {
      provide: CACHE_SERVICE,
      useFactory: (config: ConfigService<EnvConfig>, circuitBreaker: CircuitBreakerAdapter) => {
        const redisUrl = config.get('REDIS_URL', { infer: true })!;
        const redisConfig: RedisConfig = {
          url: redisUrl,
          connectTimeout: 10 * 1_000,
          commandTimeout: 5 * 1_000,
        };

        const adapter = new RedisCacheAdapter(redisConfig);
        return createProtectedRedisAdapter(adapter, circuitBreaker);
      },
      inject: [ConfigService, CircuitBreakerAdapter],
    },
    {
      provide: STORAGE_SERVICE,
      useFactory: (config: ConfigService<EnvConfig>, circuitBreaker: CircuitBreakerAdapter) => {
        const s3Config: S3Config = {
          endpoint: config.get('S3_ENDPOINT', { infer: true })!,
          region: config.get('S3_REGION', { infer: true })!,
          accessKeyId: config.get('S3_ACCESS_KEY', { infer: true })!,
          secretAccessKey: config.get('S3_SECRET_KEY', { infer: true })!,
          bucket: config.get('S3_BUCKET', { infer: true })!,
          forcePathStyle: config.get('S3_FORCE_PATH_STYLE', { infer: true }),
        };

        const adapter = new S3StorageAdapter(s3Config);
        return createProtectedS3Adapter(adapter, circuitBreaker);
      },
      inject: [ConfigService, CircuitBreakerAdapter],
    },
    {
      provide: MEDIA_SERVICE,
      useFactory: (config: ConfigService<EnvConfig>, circuitBreaker: CircuitBreakerAdapter) => {
        const liveKitConfig: LiveKitConfig = {
          url: config.get('LIVEKIT_URL', { infer: true })!,
          apiKey: config.get('LIVEKIT_API_KEY', { infer: true })!,
          apiSecret: config.get('LIVEKIT_API_SECRET', { infer: true })!,
        };

        const adapter = new LiveKitAdapter(liveKitConfig);
        return createProtectedLiveKitAdapter(adapter, circuitBreaker);
      },
      inject: [ConfigService, CircuitBreakerAdapter],
    },

    {
      provide: EXECUTION_CLIENT,
      useFactory: (
        config: ConfigService<EnvConfig>,
        queueService: IQueueService,
        cacheService: ICacheService,
      ) => {
        const useStub = config.get('USE_EXECUTION_STUB', { infer: true });

        if (useStub) {
          return new StubExecutionClient({
            delayMs: 1_000,
            failRate: 0.05,
          });
        }

        return new QueueExecutionClient(queueService, cacheService);
      },
      inject: [ConfigService, QUEUE_SERVICE, CACHE_SERVICE],
    },
    {
      provide: AI_CLIENT,
      useFactory: (
        config: ConfigService<EnvConfig>,
        queueService: IQueueService,
        cacheService: ICacheService,
      ) => {
        const useStub = config.get('USE_AI_STUB', { infer: true });

        if (useStub) {
          return new StubAiClient({
            delayMs: 1.5 * 1_000,
          });
        }

        return new QueueAiClient(queueService, cacheService);
      },
      inject: [ConfigService, QUEUE_SERVICE, CACHE_SERVICE],
    },
    {
      provide: COLLAB_CLIENT,
      useFactory: (config: ConfigService<EnvConfig>, circuitBreaker: CircuitBreakerAdapter) => {
        const useStub = config.get('USE_COLLAB_STUB', { infer: true });

        if (useStub) {
          return new StubCollabClient({
            delayMs: 200,
            failRate: 0.05,
          });
        }

        const collabUrl = config.get('COLLAB_PLANE_URL', { infer: true })!;
        const client = new HttpCollabClient(collabUrl);
        return createProtectedCollabClient(client, circuitBreaker);
      },
      inject: [ConfigService, CircuitBreakerAdapter],
    },
  ],
  exports: [
    CircuitBreakerModule,
    QUEUE_SERVICE,
    CACHE_SERVICE,
    STORAGE_SERVICE,
    MEDIA_SERVICE,
    EXECUTION_CLIENT,
    AI_CLIENT,
    COLLAB_CLIENT,
  ],
})
export class InfrastructureModule {}
