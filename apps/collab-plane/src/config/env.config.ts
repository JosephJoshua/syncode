import { z } from 'zod';

const DEFAULT_INTERNAL_CALLBACK_SECRET = 'dev-internal-callback-secret-change-me-1234567890';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().positive().default(3001),
  CONTROL_PLANE_URL: z.url().default('http://localhost:3000'),
  COLLAB_JWT_SECRET: z.string().min(32, 'COLLAB_JWT_SECRET must be at least 32 characters'),
  INTERNAL_CALLBACK_SECRET: z
    .string()
    .min(32, 'INTERNAL_CALLBACK_SECRET must be at least 32 characters')
    .default(DEFAULT_INTERNAL_CALLBACK_SECRET),
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

  if (
    parsed.data.NODE_ENV === 'production' &&
    parsed.data.INTERNAL_CALLBACK_SECRET === DEFAULT_INTERNAL_CALLBACK_SECRET
  ) {
    throw new Error(
      'Environment validation failed:\n - INTERNAL_CALLBACK_SECRET: must be explicitly set in production and must not use the development default',
    );
  }

  return parsed.data;
}
