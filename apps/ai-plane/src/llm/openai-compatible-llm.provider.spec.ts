import { describe, expect, it, vi } from 'vitest';
import { OpenAiCompatibleLlmProvider } from './openai-compatible-llm.provider.js';

describe('OpenAiCompatibleLlmProvider', () => {
  it('GIVEN valid response WHEN generateText THEN returns first completion content and model', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'qwen3.5-mini',
        choices: [{ message: { content: '{"ok":true}' } }],
      }),
    });

    const provider = new OpenAiCompatibleLlmProvider(
      {
        baseUrl: 'https://example.com/v1',
        apiKey: 'secret',
        model: 'qwen3.5-mini',
        timeoutMs: 1000,
      },
      fetchImpl as typeof fetch,
    );

    const result = await provider.generateText({
      messages: [
        { role: 'system', content: 'Return JSON.' },
        { role: 'user', content: 'Do it.' },
      ],
      temperature: 0,
      maxOutputTokens: 256,
    });

    expect(result).toEqual({ text: '{"ok":true}', model: 'qwen3.5-mini' });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer secret',
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('GIVEN non-200 response WHEN generateText THEN throws provider error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'unauthorized',
    });

    const provider = new OpenAiCompatibleLlmProvider(
      {
        baseUrl: 'https://example.com/v1',
        apiKey: 'secret',
        model: 'qwen3.5-mini',
        timeoutMs: 1000,
      },
      fetchImpl as typeof fetch,
    );

    await expect(
      provider.generateText({
        messages: [{ role: 'user', content: 'hello' }],
      }),
    ).rejects.toThrow('LLM request failed with 401: unauthorized');
  });
});
