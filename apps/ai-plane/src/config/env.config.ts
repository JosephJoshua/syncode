import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  REDIS_URL: z.url().default('redis://localhost:6379'),
  AI_PROVIDER: z.enum(['openai-compatible']).default('openai-compatible'),
  AI_PLATFORM_BASE_URL: z.url().default('https://lab.cs.tsinghua.edu.cn/ai-platform/api/v1'),
  AI_PLATFORM_API_KEY: z.string().min(1),
  AI_PLATFORM_MODEL: z.string().default('qwen3.5-mini'),
  AI_HINT_MODEL: z.string().default('qwen3.5-mini'),
  AI_TTS_MODEL: z.string().default('qwen-tts'),
  AI_TTS_VOICE: z.string().default('Chelsie'),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
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
