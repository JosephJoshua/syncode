import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullMqAdapter, type RedisConfig } from '@syncode/infrastructure';
import { QUEUE_SERVICE } from '@syncode/shared/ports';
import type { EnvConfig } from '../config/env.config';

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
  ],
  exports: [QUEUE_SERVICE],
})
export class InfrastructureModule {}
