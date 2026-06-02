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
    expect(env.AI_MAX_CONCURRENT_TASKS).toBe(5);
    expect(env.AI_RESERVED_REALTIME_SLOTS).toBe(2);
    expect(env.AI_MAX_BATCH_CONCURRENT_TASKS).toBe(5);
    expect(env.AI_TTS_MODEL).toBeUndefined();
    expect(env.AI_INTERVIEWER_LIVEKIT_ENABLED).toBe(false);
    expect(env.AI_INTERVIEWER_AGENT_NAME).toBe('syncode-ai-interviewer');
    expect(env.AI_INTERVIEWER_AGENT_IDENTITY).toBe('ai-interviewer');
    expect(env.AI_INTERVIEWER_RECONNECT_GRACE_MS).toBe(60_000);
    expect(env.AI_INTERVIEWER_LIVEKIT_PREWARM_ENABLED).toBe(true);
    expect(env.AI_INTERVIEWER_LIVEKIT_PREWARM_TIMEOUT_MS).toBe(30_000);
    expect(env.AI_INTERVIEWER_WORKER_INITIALIZE_TIMEOUT_MS).toBe(60_000);
    expect(env.AI_INTERVIEWER_WORKER_SHUTDOWN_TIMEOUT_MS).toBe(120_000);
    expect(env.LIVEKIT_AGENT_CONNECT_URL).toBeUndefined();
    expect(env.OPENAI_CHAT_FALLBACK_MODEL).toBe('gpt-4o-mini');
    expect(env.OPENAI_TTS_MODEL).toBe('tts-1');
    expect(env.OPENAI_TTS_BASE_URL).toBe('https://api.openai.com/v1');
    expect(env.OPENAI_REALTIME_MODEL).toBe('gpt-realtime');
    expect(env.OPENAI_REALTIME_VOICE).toBe('alloy');
    expect(env.OPENAI_REALTIME_PROXY_URL).toBeUndefined();
    expect(env.OPENAI_REALTIME_CONNECT_TIMEOUT_MS).toBe(5_000);
    expect(env.AI_INTERVIEWER_FORCE_FALLBACK).toBe(false);
    expect(env.S3_BUCKET).toBe('syncode');
  });

  it('GIVEN missing AI API key WHEN validating THEN fails startup config validation', () => {
    const { AI_PLATFORM_API_KEY: _apiKey, ...withoutApiKey } = baseEnv;

    expect(() => validateEnv(withoutApiKey)).toThrow(/AI_PLATFORM_API_KEY/);
  });

  it('GIVEN livekit interviewer enabled without required creds WHEN validating THEN fails', () => {
    expect(() =>
      validateEnv({
        ...baseEnv,
        AI_INTERVIEWER_LIVEKIT_ENABLED: 'true',
      }),
    ).toThrow(/LIVEKIT_URL/);
  });
});
