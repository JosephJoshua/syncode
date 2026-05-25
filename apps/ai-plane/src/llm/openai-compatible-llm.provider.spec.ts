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
        sttModel: 'glm-asr',
        ttsModel: 'qwen-tts',
        ttsVoice: 'Chelsie',
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

  it('GIVEN jsonMode WHEN generateText THEN requests JSON object output', async () => {
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
        sttModel: 'glm-asr',
        ttsModel: 'qwen-tts',
        ttsVoice: 'Chelsie',
        timeoutMs: 1000,
      },
      fetchImpl as typeof fetch,
    );

    await provider.generateText({
      messages: [{ role: 'user', content: 'Return JSON.' }],
      jsonMode: true,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.com/v1/chat/completions',
      expect.objectContaining({
        body: JSON.stringify({
          model: 'qwen3.5-mini',
          messages: [{ role: 'user', content: 'Return JSON.' }],
          temperature: 0.1,
          max_tokens: undefined,
          response_format: { type: 'json_object' },
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
        sttModel: 'glm-asr',
        ttsModel: 'qwen-tts',
        ttsVoice: 'Chelsie',
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

  it('GIVEN transient 502 responses WHEN generateText THEN retries and eventually succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: async () => 'bad gateway',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: async () => 'bad gateway',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'qwen3.6-plus',
          choices: [{ message: { content: '{"ok":true}' } }],
        }),
      });

    const provider = new OpenAiCompatibleLlmProvider(
      {
        baseUrl: 'https://example.com/v1',
        apiKey: 'secret',
        model: 'qwen3.6-plus',
        sttModel: 'glm-asr',
        ttsModel: 'qwen-tts',
        ttsVoice: 'Chelsie',
        timeoutMs: 1000,
      },
      fetchImpl as typeof fetch,
    );

    const result = await provider.generateText({
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(result).toEqual({ text: '{"ok":true}', model: 'qwen3.6-plus' });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('GIVEN valid speech response WHEN generateSpeech THEN returns audio bytes and mime type', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: vi.fn().mockReturnValue('audio/mpeg'),
      },
      arrayBuffer: async () => Uint8Array.from([1, 2, 3, 4]).buffer,
    });

    const provider = new OpenAiCompatibleLlmProvider(
      {
        baseUrl: 'https://example.com/v1',
        apiKey: 'secret',
        model: 'qwen3.5-mini',
        sttModel: 'glm-asr',
        ttsModel: 'qwen-tts',
        ttsVoice: 'Chelsie',
        timeoutMs: 1000,
      },
      fetchImpl as typeof fetch,
    );

    const result = await provider.generateSpeech({
      text: 'Explain the invariant.',
      format: 'mp3',
    });

    expect(result).toEqual({
      audio: Buffer.from([1, 2, 3, 4]),
      model: 'qwen-tts',
      mimeType: 'audio/mpeg',
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.com/v1/audio/speech',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          model: 'qwen-tts',
          input: 'Explain the invariant.',
          voice: 'Chelsie',
          response_format: 'mp3',
        }),
      }),
    );
  });

  it('GIVEN no default TTS model and no per-request model WHEN generateSpeech THEN throws config error', async () => {
    const provider = new OpenAiCompatibleLlmProvider(
      {
        baseUrl: 'https://example.com/v1',
        apiKey: 'secret',
        model: 'qwen3.5-mini',
        sttModel: 'glm-asr',
        ttsVoice: 'Chelsie',
        timeoutMs: 1000,
      },
      vi.fn() as typeof fetch,
    );

    await expect(
      provider.generateSpeech({
        text: 'Explain the invariant.',
      }),
    ).rejects.toThrow('TTS model is not configured');
  });

  it('GIVEN valid transcription response WHEN generateTranscription THEN returns transcript text', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        text: 'hello from speech',
      }),
    });

    const provider = new OpenAiCompatibleLlmProvider(
      {
        baseUrl: 'https://example.com/v1',
        apiKey: 'secret',
        model: 'qwen3.5-mini',
        sttModel: 'glm-asr',
        ttsModel: 'qwen-tts',
        ttsVoice: 'Chelsie',
        timeoutMs: 1000,
      },
      fetchImpl as typeof fetch,
    );

    const result = await provider.generateTranscription({
      audio: Buffer.from([1, 2, 3]),
      mimeType: 'audio/webm',
      fileName: 'sample.webm',
      language: 'en-US',
    });

    expect(result).toEqual({
      text: 'hello from speech',
      model: 'glm-asr',
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.com/v1/audio/transcriptions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer secret',
        }),
      }),
    );
  });

  it('GIVEN failed transcription response WHEN generateTranscription THEN throws provider error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'bad request',
    });

    const provider = new OpenAiCompatibleLlmProvider(
      {
        baseUrl: 'https://example.com/v1',
        apiKey: 'secret',
        model: 'qwen3.5-mini',
        sttModel: 'glm-asr',
        ttsModel: 'qwen-tts',
        ttsVoice: 'Chelsie',
        timeoutMs: 1000,
      },
      fetchImpl as typeof fetch,
    );

    await expect(
      provider.generateTranscription({
        audio: Buffer.from([1, 2, 3]),
        mimeType: 'audio/webm',
        fileName: 'sample.webm',
      }),
    ).rejects.toThrow('STT request failed with 400: bad request');
  });

  it('GIVEN retryable transcription status WHEN generateTranscription THEN surfaces final retryable error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => 'bad gateway',
    });

    const provider = new OpenAiCompatibleLlmProvider(
      {
        baseUrl: 'https://example.com/v1',
        apiKey: 'secret',
        model: 'qwen3.5-mini',
        sttModel: 'glm-asr',
        ttsModel: 'qwen-tts',
        ttsVoice: 'Chelsie',
        timeoutMs: 1000,
      },
      fetchImpl as typeof fetch,
    );

    await expect(
      provider.generateTranscription({
        audio: Buffer.from([1, 2, 3]),
        mimeType: 'audio/webm',
        fileName: 'sample.webm',
      }),
    ).rejects.toThrow('STT request failed with 502: bad gateway');
  });

  it('GIVEN abort transport error WHEN generateTranscription THEN throws timeout message', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    const fetchImpl = vi.fn().mockRejectedValue(abortError);

    const provider = new OpenAiCompatibleLlmProvider(
      {
        baseUrl: 'https://example.com/v1',
        apiKey: 'secret',
        model: 'qwen3.5-mini',
        sttModel: 'glm-asr',
        ttsModel: 'qwen-tts',
        ttsVoice: 'Chelsie',
        timeoutMs: 1000,
      },
      fetchImpl as typeof fetch,
    );

    await expect(
      provider.generateTranscription({
        audio: Buffer.from([1, 2, 3]),
        mimeType: 'audio/webm',
        fileName: 'sample.webm',
      }),
    ).rejects.toThrow('STT request timed out after 1000ms');
  });

  it('GIVEN fetch network failure WHEN generateText THEN retries until success', async () => {
    const networkError = new TypeError('fetch failed');
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(networkError)
      .mockResolvedValue({
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
        sttModel: 'glm-asr',
        ttsModel: 'qwen-tts',
        ttsVoice: 'Chelsie',
        timeoutMs: 1000,
      },
      fetchImpl as typeof fetch,
    );

    const result = await provider.generateText({
      messages: [{ role: 'user', content: 'ping' }],
    });
    expect(result.text).toBe('{"ok":true}');
  });

  it('GIVEN codec-suffixed mime type WHEN generateTranscription THEN normalizes uploaded file metadata', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        text: 'hello from speech',
      }),
    });

    const provider = new OpenAiCompatibleLlmProvider(
      {
        baseUrl: 'https://example.com/v1',
        apiKey: 'secret',
        model: 'qwen3.5-mini',
        sttModel: 'glm-asr',
        ttsModel: 'qwen-tts',
        ttsVoice: 'Chelsie',
        timeoutMs: 1000,
      },
      fetchImpl as typeof fetch,
    );

    await provider.generateTranscription({
      audio: Buffer.from([1, 2, 3]),
      mimeType: 'audio/webm;codecs=opus',
      fileName: 'sample.raw',
    });

    const requestInit = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    const formData = requestInit.body as FormData;
    const uploadedFile = formData.get('file');

    expect(uploadedFile).toBeInstanceOf(File);
    expect((uploadedFile as File).type).toBe('audio/webm');
    expect((uploadedFile as File).name).toBe('sample.webm');
  });
});
