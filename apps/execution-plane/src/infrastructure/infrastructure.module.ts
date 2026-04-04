import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullMqAdapter, type RedisConfig } from '@syncode/infrastructure';
import { QUEUE_SERVICE, SANDBOX_PROVIDER } from '@syncode/shared/ports';
import type { EnvConfig } from '../config/env.config.js';
import { E2bSandboxAdapter } from './sandbox/e2b-sandbox.adapter.js';

@Global()
@Module({
  providers: [
    {
      provide: QUEUE_SERVICE,
      useFactory: (config: ConfigService<EnvConfig>) => {
        const redisConfig: RedisConfig = {
          url: config.get('REDIS_URL', { infer: true })!,
        };
        return new BullMqAdapter(redisConfig);
      },
      inject: [ConfigService],
    },
    {
      provide: SANDBOX_PROVIDER,
      useFactory: (config: ConfigService<EnvConfig>) => {
        return new E2bSandboxAdapter(config.get('E2B_API_KEY', { infer: true })!);
      },
      inject: [ConfigService],
    },
  ],
  exports: [QUEUE_SERVICE, SANDBOX_PROVIDER],
})
export class InfrastructureModule {}
