import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    REDIS_URL: z.url().default('redis://localhost:6379'),
    INTERNAL_CALLBACK_SECRET: z.string().min(32).optional(),
    AI_INTERVIEWER_LIVEKIT_ENABLED: z
      .union([z.boolean(), z.string()])
      .transform((val) => val === true || val === 'true' || val === '1')
      .default(false),
    AI_INTERVIEWER_AGENT_NAME: z.string().min(1).default('syncode-ai-interviewer'),
    AI_INTERVIEWER_AGENT_IDENTITY: z.string().min(1).default('ai-interviewer'),
    AI_INTERVIEWER_CONTROL_PLANE_URL: z.url().default('http://localhost:3000'),
    LIVEKIT_URL: z.url().optional(),
    LIVEKIT_API_KEY: z.string().min(1).optional(),
    LIVEKIT_API_SECRET: z.string().min(1).optional(),
    OPENAI_API_KEY: z.string().min(1).optional(),
    OPENAI_REALTIME_MODEL: z.string().min(1).default('gpt-realtime'),
    OPENAI_REALTIME_VOICE: z.string().min(1).default('alloy'),
    OPENAI_REALTIME_BASE_URL: z.url().default('https://api.openai.com/v1'),
    AI_INTERVIEWER_FALLBACK_ENABLED: z
      .union([z.boolean(), z.string()])
      .transform((val) => val === true || val === 'true' || val === '1')
      .default(true),
    AI_PROVIDER: z.enum(['openai-compatible']).default('openai-compatible'),
    AI_PLATFORM_BASE_URL: z.url().default('https://llmapi.paratera.com'),
    AI_PLATFORM_API_KEY: z.string().min(1),
    AI_PLATFORM_MODEL: z.string().default('DeepSeek-V3.2-Instruct'),
    AI_HINT_MODEL: z.string().default('DeepSeek-V3.2-Instruct'),
    AI_STT_MODEL: z.string().default('GLM-ASR-2512'),
    AI_TTS_MODEL: z.string().trim().min(1).optional(),
    AI_TTS_VOICE: z.string().default('Chelsie'),
    AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
    AI_MAX_CONCURRENT_TASKS: z.coerce.number().int().positive().default(5),
    AI_RESERVED_REALTIME_SLOTS: z.coerce.number().int().min(0).default(2),
    AI_MAX_BATCH_CONCURRENT_TASKS: z.coerce.number().int().positive().default(5),
    S3_ENDPOINT: z.url(),
    S3_PUBLIC_ENDPOINT: z.url().optional(),
    S3_ACCESS_KEY: z.string().min(1),
    S3_SECRET_KEY: z.string().min(1),
    S3_BUCKET: z.string().min(1),
    S3_REGION: z.string().default('us-east-1'),
    S3_FORCE_PATH_STYLE: z
      .union([z.boolean(), z.string()])
      .transform((val) => val === true || val === 'true' || val === '1')
      .default(true),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
  })
  .superRefine((env, ctx) => {
    if (!env.AI_INTERVIEWER_LIVEKIT_ENABLED) {
      return;
    }

    if (!env.LIVEKIT_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['LIVEKIT_URL'],
        message: 'LIVEKIT_URL is required when AI_INTERVIEWER_LIVEKIT_ENABLED=true',
      });
    }
    if (!env.LIVEKIT_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['LIVEKIT_API_KEY'],
        message: 'LIVEKIT_API_KEY is required when AI_INTERVIEWER_LIVEKIT_ENABLED=true',
      });
    }
    if (!env.LIVEKIT_API_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['LIVEKIT_API_SECRET'],
        message: 'LIVEKIT_API_SECRET is required when AI_INTERVIEWER_LIVEKIT_ENABLED=true',
      });
    }
    if (!env.INTERNAL_CALLBACK_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['INTERNAL_CALLBACK_SECRET'],
        message: 'INTERNAL_CALLBACK_SECRET is required when AI_INTERVIEWER_LIVEKIT_ENABLED=true',
      });
    }
    if (!env.OPENAI_API_KEY && !env.AI_INTERVIEWER_FALLBACK_ENABLED) {
      ctx.addIssue({
        code: 'custom',
        path: ['OPENAI_API_KEY'],
        message:
          'OPENAI_API_KEY is required when AI_INTERVIEWER_LIVEKIT_ENABLED=true and fallback is disabled',
      });
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((err) => `${err.path.join('.')}: ${err.message}`);
    const errorsStr = errors.map((e) => ` - ${e}`).join('\n');
    throw new Error(`Environment validation failed:\n${errorsStr}`);
  }
  return parsed.data;
}
