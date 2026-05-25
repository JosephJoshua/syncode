import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.config.js';

const baseEnv = {
  AI_PLATFORM_API_KEY: 'test-key',
  S3_ENDPOINT: 'http://localhost:8333',
  S3_ACCESS_KEY: 'syncode',
  S3_SECRET_KEY: 'syncode-secret',
  S3_BUCKET: 'syncode',
};

describe('validateEnv', () => {
  it('GIVEN required AI and storage config WHEN validating THEN returns defaults for optional values', () => {
    const env = validateEnv(baseEnv);

    expect(env.AI_PLATFORM_API_KEY).toBe('test-key');
    expect(env.AI_PLATFORM_MODEL).toBe('DeepSeek-V3.2-Instruct');
    expect(env.AI_TTS_MODEL).toBeUndefined();
    expect(env.S3_BUCKET).toBe('syncode');
  });

  it('GIVEN missing AI API key WHEN validating THEN fails startup config validation', () => {
    const { AI_PLATFORM_API_KEY: _apiKey, ...withoutApiKey } = baseEnv;

    expect(() => validateEnv(withoutApiKey)).toThrow(/AI_PLATFORM_API_KEY/);
  });
});
