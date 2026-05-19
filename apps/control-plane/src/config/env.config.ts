import { z } from 'zod';

const DEFAULT_INTERNAL_CALLBACK_SECRET = 'dev-internal-callback-secret-change-me-1234567890';

/**
 * Parses an env var string into a boolean.
 */
const booleanEnv = z
  .union([z.boolean(), z.string()])
  .transform((val) => val === true || val === 'true' || val === '1');

const commaSeparatedListEnv = z
  .string()
  .default('')
  .transform((val) =>
    val
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );

/**
 * Environment variable validation schema
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().positive().default(3000),

    DATABASE_URL: z.url(),

    REDIS_URL: z.url(),

    AUTH_JWT_SECRET: z.string().min(32, 'AUTH_JWT_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    JWT_EXPIRATION: z.string().default('15m'),
    JWT_REFRESH_EXPIRATION: z.string().default('7d'),

    COLLAB_JWT_SECRET: z.string().min(32, 'COLLAB_JWT_SECRET must be at least 32 characters'),

    INTERNAL_CALLBACK_SECRET: z
      .string()
      .min(32, 'INTERNAL_CALLBACK_SECRET must be at least 32 characters')
      .default(DEFAULT_INTERNAL_CALLBACK_SECRET),

    S3_ENDPOINT: z.url(),
    S3_PUBLIC_ENDPOINT: z.url().optional(),
    S3_ACCESS_KEY: z.string().min(1),
    S3_SECRET_KEY: z.string().min(1),
    S3_BUCKET: z.string().min(1),
    S3_REGION: z.string().default('us-east-1'),
    S3_FORCE_PATH_STYLE: booleanEnv.default(true),

    LIVEKIT_API_KEY: z.string().min(1),
    LIVEKIT_API_SECRET: z.string().min(1),
    LIVEKIT_URL: z.url(),
    LIVEKIT_CLIENT_URL: z.url().optional(),

    COLLAB_PLANE_URL: z.url().default('http://localhost:3001'),
    COLLAB_PLANE_CLIENT_URL: z.url().optional(),

    USE_EXECUTION_STUB: booleanEnv.default(false),
    USE_AI_STUB: booleanEnv.default(false),
    USE_COLLAB_STUB: booleanEnv.default(false),

    OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),

    CORS_ORIGINS: z
      .string()
      .default('http://localhost:5173,https://syncode.anggita.org')
      .transform((val) => val.split(',').map((origin) => origin.trim())),
    TRUSTED_PROXIES: commaSeparatedListEnv.describe(
      'Comma-separated Express trust proxy values. Leave empty to ignore forwarded IP headers.',
    ),

    THROTTLE_TTL_SECS: z.coerce
      .number()
      .positive()
      .default(60)
      .describe('Rate limit window in seconds'),
    THROTTLE_LIMIT: z.coerce.number().positive().default(120),
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
  )
  .refine(
    (env) =>
      env.NODE_ENV !== 'production' ||
      env.INTERNAL_CALLBACK_SECRET !== DEFAULT_INTERNAL_CALLBACK_SECRET,
    {
      message:
        'INTERNAL_CALLBACK_SECRET must be explicitly set in production and must not use the development default.',
      path: ['INTERNAL_CALLBACK_SECRET'],
    },
  )
  .refine((env) => env.NODE_ENV !== 'production' || env.TRUSTED_PROXIES.length > 0, {
    message: 'TRUSTED_PROXIES must be explicitly set in production.',
    path: ['TRUSTED_PROXIES'],
  });

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
    const formatted = errors.map((e) => `  - ${e}`).join('\n');
    throw new Error(`Environment validation failed:\n${formatted}`);
  }

  return parsed.data;
}
