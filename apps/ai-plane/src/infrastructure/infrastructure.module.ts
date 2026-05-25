import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BullMqAdapter,
  type RedisConfig,
  type S3Config,
  S3StorageAdapter,
} from '@syncode/infrastructure';
import { QUEUE_SERVICE, STORAGE_SERVICE } from '@syncode/shared/ports';
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
      provide: STORAGE_SERVICE,
      useFactory: (config: ConfigService<EnvConfig>) => {
        const s3Config: S3Config = {
          endpoint: config.get('S3_ENDPOINT', { infer: true })!,
          publicEndpoint: config.get('S3_PUBLIC_ENDPOINT', { infer: true }),
          region: config.get('S3_REGION', { infer: true })!,
          accessKeyId: config.get('S3_ACCESS_KEY', { infer: true })!,
          secretAccessKey: config.get('S3_SECRET_KEY', { infer: true })!,
          bucket: config.get('S3_BUCKET', { infer: true })!,
          forcePathStyle: config.get('S3_FORCE_PATH_STYLE', { infer: true })!,
        };
        return new S3StorageAdapter(s3Config);
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
          sttModel: config.get('AI_STT_MODEL', { infer: true })!,
          ttsModel: config.get('AI_TTS_MODEL', { infer: true }),
          ttsVoice: config.get('AI_TTS_VOICE', { infer: true })!,
          timeoutMs: config.get('AI_REQUEST_TIMEOUT_MS', { infer: true })!,
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [QUEUE_SERVICE, STORAGE_SERVICE, LLM_PROVIDER],
})
export class InfrastructureModule {}
