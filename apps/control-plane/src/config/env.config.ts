import { z } from 'zod';

/**
 * Environment variable validation schema
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().positive().default(3000),

    DATABASE_URL: z.url(),

    REDIS_URL: z.url(),

    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    JWT_EXPIRATION: z.string().default('15m'),
    JWT_REFRESH_EXPIRATION: z.string().default('7d'),

    S3_ENDPOINT: z.url(),
    S3_ACCESS_KEY: z.string().min(1),
    S3_SECRET_KEY: z.string().min(1),
    S3_BUCKET: z.string().min(1),
    S3_REGION: z.string().default('us-east-1'),
    S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),

    LIVEKIT_API_KEY: z.string().min(1),
    LIVEKIT_API_SECRET: z.string().min(1),
    LIVEKIT_URL: z.url(),

    COLLAB_PLANE_URL: z.url().default('http://localhost:3001'),

    USE_EXECUTION_STUB: z.coerce.boolean().default(false),
    USE_AI_STUB: z.coerce.boolean().default(false),
    USE_COLLAB_STUB: z.coerce.boolean().default(false),

    OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),

    CORS_ORIGINS: z
      .string()
      .default('http://localhost:5173,https://syncode.anggita.org')
      .transform((val) => val.split(',').map((origin) => origin.trim())),

    THROTTLE_TTL_SECS: z.coerce
      .number()
      .positive()
      .default(60)
      .describe('Rate limit window in seconds'),
    THROTTLE_LIMIT: z.coerce.number().positive().default(10),
  })
  .refine(
    (env) => {
      if (
        env.NODE_ENV === 'production' &&
        (env.USE_EXECUTION_STUB || env.USE_AI_STUB || env.USE_COLLAB_STUB)
      ) {
        return false;
      }

      return true;
    },
    {
      message:
        'Production environment cannot use stubs. Set USE_EXECUTION_STUB=false, USE_AI_STUB=false, and USE_COLLAB_STUB=false in production.',
    },
  );

/**
 * Validated environment configuration type
 */
export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validates environment variables using Zod schema
 *
 * @param config - Raw environment variables
 * @returns Validated and typed environment configuration
 * @throws ZodError if validation fails
 */
export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    const errors = parsed.error.issues.map((err) => `${err.path.join('.')}: ${err.message}`);
    throw new Error(`Environment validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  }

  return parsed.data;
}
