import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullMqAdapter, type RedisConfig } from '@syncode/infrastructure';
import { QUEUE_SERVICE } from '@syncode/shared/ports';
import type { EnvConfig } from '../config/env.config.js';
import { LLM_PROVIDER } from '../llm/llm.constants.js';
import { OpenAiCompatibleLlmProvider } from '../llm/openai-compatible-llm.provider.js';

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
      provide: LLM_PROVIDER,
      useFactory: (config: ConfigService<EnvConfig>) => {
        return new OpenAiCompatibleLlmProvider({
          baseUrl: config.get('AI_PLATFORM_BASE_URL', { infer: true })!,
          apiKey: config.get('AI_PLATFORM_API_KEY', { infer: true })!,
          model: config.get('AI_PLATFORM_MODEL', { infer: true })!,
          timeoutMs: config.get('AI_REQUEST_TIMEOUT_MS', { infer: true })!,
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [QUEUE_SERVICE, LLM_PROVIDER],
})
export class InfrastructureModule {}
