import { Injectable } from '@nestjs/common';
import type { EnvConfig } from '../config/env.config.js';
import type {
  ILlmProvider,
  LlmGenerateSpeechInput,
  LlmGenerateSpeechResult,
  LlmGenerateTextInput,
  LlmGenerateTextResult,
  LlmGenerateTranscriptionInput,
  LlmGenerateTranscriptionResult,
} from './llm.types.js';

interface OpenAiCompatibleProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  sttModel: string;
  ttsModel?: string;
  ttsVoice: string;
  timeoutMs: number;
}

interface OpenAiChatCompletionResponse {
  model?: string;
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

interface OpenAiTranscriptionResponse {
  text?: string | null;
}

const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 1_000;
const STT_MAX_RETRY_ATTEMPTS = 1;
const STT_TIMEOUT_CAP_MS = 10_000;

@Injectable()
export class OpenAiCompatibleLlmProvider implements ILlmProvider {
  constructor(
    private readonly config: OpenAiCompatibleProviderConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  static fromEnv(config: EnvConfig): OpenAiCompatibleLlmProvider {
    return new OpenAiCompatibleLlmProvider({
      baseUrl: config.AI_PLATFORM_BASE_URL,
      apiKey: config.AI_PLATFORM_API_KEY,
      model: config.AI_PLATFORM_MODEL,
      sttModel: config.AI_STT_MODEL,
      ttsModel: config.AI_TTS_MODEL,
      ttsVoice: config.AI_TTS_VOICE,
      timeoutMs: config.AI_REQUEST_TIMEOUT_MS,
    });
  }

  async generateText(input: LlmGenerateTextInput): Promise<LlmGenerateTextResult> {
    const model = input.model ?? this.config.model;
    const apiBaseUrl = normalizeOpenAiCompatibleBaseUrl(this.config.baseUrl);
    const requestBody = {
      model,
      messages: input.messages,
      temperature: input.temperature ?? 0.1,
      max_tokens: input.maxOutputTokens,
      ...(input.jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
    };

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

      try {
        const response = await this.fetchImpl(`${apiBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();

          if (attempt < MAX_RETRY_ATTEMPTS && isRetryableStatus(response.status)) {
            await delay(getRetryDelayMs(attempt));
            continue;
          }

          throw new Error(`LLM request failed with ${response.status}: ${errorText}`);
        }

        const data = (await response.json()) as OpenAiChatCompletionResponse;
        const text = data.choices?.[0]?.message?.content?.trim();

        if (!text) {
          throw new Error('LLM response did not include message content');
        }

        return {
          text,
          model: data.model ?? model,
        };
      } catch (error) {
        if (attempt < MAX_RETRY_ATTEMPTS && isRetryableTransportError(error)) {
          await delay(getRetryDelayMs(attempt));
          continue;
        }

        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new Error('LLM request failed after retries');
  }

  async generateSpeech(input: LlmGenerateSpeechInput): Promise<LlmGenerateSpeechResult> {
    const model = input.model ?? this.config.ttsModel;
    if (!model) {
      throw new Error('TTS model is not configured');
    }
    const format = input.format ?? 'mp3';
    const apiBaseUrl = normalizeOpenAiCompatibleBaseUrl(this.config.baseUrl);
    const requestBody = {
      model,
      input: input.text,
      voice: input.voice ?? this.config.ttsVoice,
      response_format: format,
    };

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

      try {
        const response = await this.fetchImpl(`${apiBaseUrl}/audio/speech`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();

          if (attempt < MAX_RETRY_ATTEMPTS && isRetryableStatus(response.status)) {
            await delay(getRetryDelayMs(attempt));
            continue;
          }

          throw new Error(`TTS request failed with ${response.status}: ${errorText}`);
        }

        const audio = Buffer.from(await response.arrayBuffer());
        return {
          audio,
          model,
          mimeType: response.headers.get('content-type') ?? mimeTypeForAudioFormat(format),
        };
      } catch (error) {
        if (attempt < MAX_RETRY_ATTEMPTS && isRetryableTransportError(error)) {
          await delay(getRetryDelayMs(attempt));
          continue;
        }

        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new Error('TTS request failed after retries');
  }

  async generateTranscription(
    input: LlmGenerateTranscriptionInput,
  ): Promise<LlmGenerateTranscriptionResult> {
    const model = input.model ?? this.config.sttModel;
    const apiBaseUrl = normalizeOpenAiCompatibleBaseUrl(this.config.baseUrl);
    const formData = createTranscriptionFormData(input, model);
    const timeoutMs = Math.min(this.config.timeoutMs, STT_TIMEOUT_CAP_MS);

    for (let attempt = 1; attempt <= STT_MAX_RETRY_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await this.fetchImpl(`${apiBaseUrl}/audio/transcriptions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          body: formData,
          signal: controller.signal,
        });

        const parsed = await parseTranscriptionResponse(response, model);
        if (parsed.kind === 'retryable') {
          await handleRetryableTranscriptionStatus(parsed.error, attempt);
          continue;
        }
        return parsed.result;
      } catch (error) {
        await handleTranscriptionAttemptError(error, attempt, timeoutMs);
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new Error('STT request failed after retries');
  }
}

async function handleRetryableTranscriptionStatus(error: Error, attempt: number): Promise<void> {
  if (attempt >= STT_MAX_RETRY_ATTEMPTS) {
    throw error;
  }
  await delay(getRetryDelayMs(attempt));
}

async function handleTranscriptionAttemptError(
  error: unknown,
  attempt: number,
  timeoutMs: number,
): Promise<void> {
  if (attempt < STT_MAX_RETRY_ATTEMPTS && isRetryableTransportError(error)) {
    await delay(getRetryDelayMs(attempt));
    return;
  }
  if (error instanceof Error && error.name === 'AbortError') {
    throw new Error(`STT request timed out after ${timeoutMs}ms`);
  }
  throw error;
}

function mimeTypeForAudioFormat(format: 'mp3' | 'wav') {
  return format === 'wav' ? 'audio/wav' : 'audio/mpeg';
}

function createTranscriptionFormData(
  input: LlmGenerateTranscriptionInput,
  model: string,
): FormData {
  const normalizedMimeType = normalizeTranscriptionMimeType(input.mimeType);
  const normalizedFileName = normalizeTranscriptionFileName(input.fileName, normalizedMimeType);
  const file = new Blob([Uint8Array.from(input.audio)], {
    type: normalizedMimeType,
  });
  const formData = new FormData();
  formData.append('model', model);
  formData.append('file', file, normalizedFileName);
  if (input.language?.trim()) {
    formData.append('language', input.language.trim());
  }
  return formData;
}

async function parseTranscriptionResponse(
  response: Response,
  model: string,
): Promise<
  { kind: 'ok'; result: LlmGenerateTranscriptionResult } | { kind: 'retryable'; error: Error }
> {
  if (!response.ok) {
    const errorText = await response.text();
    if (isRetryableStatus(response.status)) {
      return {
        kind: 'retryable',
        error: new Error(`STT request failed with ${response.status}: ${errorText}`),
      };
    }
    throw new Error(`STT request failed with ${response.status}: ${errorText}`);
  }

  const payload = (await response.json()) as OpenAiTranscriptionResponse;
  const text = payload.text?.trim();
  if (!text) {
    throw new Error('STT response did not include transcript text');
  }
  return {
    kind: 'ok',
    result: {
      text,
      model,
    },
  };
}

function normalizeTranscriptionMimeType(rawMimeType: string | undefined): string {
  const normalized = rawMimeType?.split(';', 1)[0]?.trim().toLowerCase();
  if (!normalized) {
    return 'audio/webm';
  }

  if (normalized === 'audio/mp3') {
    return 'audio/mpeg';
  }

  if (normalized === 'audio/x-wav') {
    return 'audio/wav';
  }

  if (normalized === 'audio/x-m4a') {
    return 'audio/m4a';
  }

  return normalized;
}

function normalizeTranscriptionFileName(fileName: string, mimeType: string): string {
  const trimmed = fileName.trim();
  if (trimmed.length === 0) {
    return `transcription.${extensionForTranscriptionMimeType(mimeType)}`;
  }

  const normalizedExtension = extensionForTranscriptionMimeType(mimeType);
  const extension = trimmed.split('.').pop()?.toLowerCase();
  if (extension === normalizedExtension) {
    return trimmed;
  }

  const dotIndex = trimmed.lastIndexOf('.');
  const withoutExtension = dotIndex > 0 ? trimmed.slice(0, dotIndex) : trimmed;
  return `${withoutExtension}.${normalizedExtension}`;
}

function extensionForTranscriptionMimeType(mimeType: string): string {
  switch (mimeType) {
    case 'audio/flac':
      return 'flac';
    case 'audio/m4a':
      return 'm4a';
    case 'audio/mp4':
      return 'mp4';
    case 'audio/mpeg':
    case 'audio/mpga':
      return 'mp3';
    case 'audio/ogg':
      return 'ogg';
    case 'audio/wav':
      return 'wav';
    case 'audio/webm':
      return 'webm';
    default:
      return 'webm';
  }
}

function normalizeOpenAiCompatibleBaseUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  const pathname = stripTrailingSlashes(url.pathname);

  if (pathname === '' || pathname === '/') {
    url.pathname = '/v1';
  } else {
    url.pathname = pathname;
  }

  return stripTrailingSlashes(url.toString());
}

function stripTrailingSlashes(value: string): string {
  let end = value.length;

  while (end > 0 && value[end - 1] === '/') {
    end -= 1;
  }

  return value.slice(0, end);
}

function isRetryableStatus(status: number) {
  return status === 502 || status === 503 || status === 504;
}

function isRetryableTransportError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

function getRetryDelayMs(attempt: number) {
  return INITIAL_RETRY_DELAY_MS * 2 ** (attempt - 1);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
