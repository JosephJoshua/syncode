import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.config.js';

const baseEnv = {
  DATABASE_URL: 'postgres://syncode:syncode@localhost:5432/syncode',
  REDIS_URL: 'redis://localhost:6379',
  AUTH_JWT_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'r'.repeat(32),
  COLLAB_JWT_SECRET: 'c'.repeat(32),
  INTERNAL_CALLBACK_SECRET: 'i'.repeat(32),
  S3_ENDPOINT: 'http://localhost:8333',
  S3_ACCESS_KEY: 'access',
  S3_SECRET_KEY: 'secret',
  S3_BUCKET: 'syncode',
  LIVEKIT_API_KEY: 'livekit-key',
  LIVEKIT_API_SECRET: 'livekit-secret',
  LIVEKIT_URL: 'http://localhost:7880',
};

describe('validateEnv', () => {
  it('GIVEN production env without trusted proxies WHEN validating THEN rejects startup config', () => {
    expect(() =>
      validateEnv({
        ...baseEnv,
        NODE_ENV: 'production',
        TRUSTED_PROXIES: '',
      }),
    ).toThrow(/TRUSTED_PROXIES/);
  });

  it('GIVEN production env with trusted proxies WHEN validating THEN parses proxy list', () => {
    const env = validateEnv({
      ...baseEnv,
      NODE_ENV: 'production',
      TRUSTED_PROXIES: 'loopback, linklocal, uniquelocal',
    });

    expect(env.TRUSTED_PROXIES).toEqual(['loopback', 'linklocal', 'uniquelocal']);
  });
});
